"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getEffectiveDb, multiplierToDb } from "@/lib/daw-sdk";
import type { Track, TrackEnvelopePoint } from "@/lib/daw-sdk";
import {
	automationViewEnabledAtom,
	playbackAtom,
	timelinePxPerMsAtom,
	updateTrackAtom,
} from "@/lib/daw-sdk";

type AutomationLaneProps = {
	track: Track;
	trackHeight: number;
	trackWidth: number;
};

export function AutomationLane({
	track,
	trackHeight,
	trackWidth,
}: AutomationLaneProps) {
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [playback] = useAtom(playbackAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [automationViewEnabled] = useAtom(automationViewEnabledAtom);
	const [draggingPoint, setDraggingPoint] = useState<{
		pointId: string;
		startX: number;
		startY: number;
		startTime: number;
		startValue: number;
		pointerId: number;
	} | null>(null);
	const [selectedSegment, setSelectedSegment] = useState<{
		fromPointId: string;
		toPointId: string;
		x: number;
		y: number;
	} | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const isDraggingRef = useRef(false);

	const envelope = track.volumeEnvelope;

	// Hooks must be called unconditionally
	const handlePointPointerDown = useCallback(
		(point: TrackEnvelopePoint, e: React.PointerEvent) => {
			e.preventDefault();
			e.stopPropagation();

			isDraggingRef.current = true;
			e.currentTarget.setPointerCapture(e.pointerId);

			setDraggingPoint({
				pointId: point.id,
				startX: e.clientX,
				startY: e.clientY,
				startTime: point.time,
				startValue: point.value,
				pointerId: e.pointerId,
			});

			// Emit event to lock grid drag
			window.dispatchEvent(new CustomEvent("wav0:automation-drag-start"));
		},
		[],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!draggingPoint || !isDraggingRef.current) return;
			if (e.pointerId !== draggingPoint.pointerId) return;

			e.preventDefault();
			e.stopPropagation();

			const padding = 20;
			const usableHeight = trackHeight - padding * 2;

			// Calculate delta Y and map to multiplier change
			const deltaY = e.clientY - draggingPoint.startY;
			const deltaValue = -(deltaY / usableHeight) * 4; // Inverted, scaled to 0-4 range
			const newValue = Math.max(
				0,
				Math.min(4, draggingPoint.startValue + deltaValue),
			);

			// Calculate delta X and map to time change (horizontal drag)
			const deltaX = e.clientX - draggingPoint.startX;
			const deltaTime = deltaX / pxPerMs;
			const newTime = Math.max(0, draggingPoint.startTime + deltaTime);

			// Update point in envelope
			if (!envelope) return;
			const updatedPoints = envelope.points.map((p) =>
				p.id === draggingPoint.pointId
					? { ...p, value: newValue, time: newTime }
					: p,
			);

			updateTrack(track.id, {
				volumeEnvelope: {
					...envelope,
					points: updatedPoints,
				},
			});
		},
		[draggingPoint, trackHeight, envelope, track.id, updateTrack, pxPerMs],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (draggingPoint && e.pointerId === draggingPoint.pointerId) {
				isDraggingRef.current = false;
				setDraggingPoint(null);
				// Emit event to unlock grid drag
				window.dispatchEvent(new CustomEvent("wav0:automation-drag-end"));
			}
		},
		[draggingPoint],
	);

	// Handle segment right-click for curve type selection
	const handleSegmentContextMenu = useCallback(
		(fromPointId: string, toPointId: string, e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setSelectedSegment({
				fromPointId,
				toPointId,
				x: e.clientX,
				y: e.clientY,
			});
		},
		[],
	);

	// Change curve type for selected segment
	// NOTE: Updates track automation immediately (no draft state)
	// This ensures curve changes in automation lane sync with drawer
	const setCurveType = useCallback(
		(curveType: TrackEnvelopePoint["curve"]) => {
			if (!selectedSegment || !envelope) return;

			// Update the curve type on the "from" point of the segment
			// The curve defines the shape from this point to the next point
			const updatedPoints = envelope.points.map((p) =>
				p.id === selectedSegment.fromPointId ? { ...p, curve: curveType } : p,
			);

			updateTrack(track.id, {
				volumeEnvelope: {
					...envelope,
					points: updatedPoints,
				},
			});

			setSelectedSegment(null);
		},
		[selectedSegment, envelope, track.id, updateTrack],
	);

	// Add new automation point on double-click
	const handleSvgDoubleClick = useCallback(
		(e: React.MouseEvent<SVGSVGElement>) => {
			if (!svgRef.current || !envelope) return;

			const rect = svgRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			// Convert pixel position to time and value
			const time = x / pxPerMs;
			const padding = 20;
			const usableHeight = trackHeight - padding * 2;
			const normalizedY = (trackHeight - padding - y) / usableHeight;
			const value = Math.max(0, Math.min(4, normalizedY * 4));

			// Create new point
			const newPoint: TrackEnvelopePoint = {
				id: `point-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
				time,
				value,
				curve: "linear",
			};

			updateTrack(track.id, {
				volumeEnvelope: {
					...envelope,
					points: [...envelope.points, newPoint],
				},
			});
		},
		[envelope, pxPerMs, trackHeight, track.id, updateTrack],
	);

	// Lock scroll while dragging automation point
	useEffect(() => {
		if (!draggingPoint) return;

		// Prevent all scroll/touch events during drag
		const preventScroll = (e: Event) => {
			e.preventDefault();
			e.stopPropagation();
		};

		// Add global event listeners to prevent scroll
		document.addEventListener("wheel", preventScroll, { passive: false });
		document.addEventListener("touchmove", preventScroll, { passive: false });

		// Prevent default drag behavior
		document.body.style.overflow = "hidden";
		document.body.style.userSelect = "none";

		return () => {
			document.removeEventListener("wheel", preventScroll);
			document.removeEventListener("touchmove", preventScroll);
			document.body.style.overflow = "";
			document.body.style.userSelect = "";
		};
	}, [draggingPoint]);

	// Close context menu on click away
	useEffect(() => {
		if (!selectedSegment) return;

		const closeMenu = () => setSelectedSegment(null);
		document.addEventListener("click", closeMenu);
		return () => document.removeEventListener("click", closeMenu);
	}, [selectedSegment]);

	// Don't render if automation view disabled
	if (!automationViewEnabled) {
		return null;
	}

	// Don't render if automation disabled or no points
	if (!envelope?.enabled || !envelope.points || envelope.points.length === 0) {
		return null;
	}

	const sorted = [...envelope.points].sort((a, b) => a.time - b.time);

	// Generate SVG path
	const generatePath = (): string => {
		if (sorted.length === 0) return "";

		const padding = 20; // Vertical padding from track edges
		const usableHeight = trackHeight - padding * 2;

		// Map multiplier (0-4) to Y position (inverted: high value = low Y)
		const multiplierToY = (multiplier: number): number => {
			const normalizedValue = Math.max(0, Math.min(4, multiplier)) / 4; // 0-1 range
			return trackHeight - padding - normalizedValue * usableHeight;
		};

		const points = sorted.map((point) => {
			const x = point.time * pxPerMs;
			const y = multiplierToY(point.value);
			return { x, y, point };
		});

		// Start path from first point
		let pathData = `M ${points[0].x} ${points[0].y}`;

		// Connect points based on curve type
		for (let i = 1; i < points.length; i++) {
			const prev = points[i - 1];
			const curr = points[i];
			const curve = curr.point.curve || "linear";

			if (curve === "easeIn") {
				// Quadratic bezier for ease-in
				const cpX = prev.x + (curr.x - prev.x) * 0.7;
				const cpY = prev.y;
				pathData += ` Q ${cpX} ${cpY}, ${curr.x} ${curr.y}`;
			} else if (curve === "easeOut") {
				// Quadratic bezier for ease-out
				const cpX = prev.x + (curr.x - prev.x) * 0.3;
				const cpY = curr.y;
				pathData += ` Q ${cpX} ${cpY}, ${curr.x} ${curr.y}`;
			} else if (curve === "sCurve") {
				// Cubic bezier for S-curve
				const cp1X = prev.x + (curr.x - prev.x) * 0.33;
				const cp1Y = prev.y;
				const cp2X = prev.x + (curr.x - prev.x) * 0.67;
				const cp2Y = curr.y;
				pathData += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${curr.x} ${curr.y}`;
			} else {
				// Linear or default
				pathData += ` L ${curr.x} ${curr.y}`;
			}
		}

		return pathData;
	};

	const path = generatePath();
	const padding = 20;
	const usableHeight = trackHeight - padding * 2;

	// Calculate playhead position on curve if playing
	let playheadX: number | null = null;
	let playheadY: number | null = null;
	if (playback.isPlaying) {
		playheadX = playback.currentTime * pxPerMs;
		// Find current multiplier at playhead
		let currentMultiplier = 1.0;
		for (const point of sorted) {
			if (point.time <= playback.currentTime) {
				currentMultiplier = point.value;
			} else {
				break;
			}
		}
		const normalizedValue = Math.max(0, Math.min(4, currentMultiplier)) / 4;
		playheadY = trackHeight - padding - normalizedValue * usableHeight;
	}

	// Derive automation color from track color (lighter version)
	const automationColor = (() => {
		const hex = track.color.replace("#", "");
		const r = Number.parseInt(hex.substring(0, 2), 16);
		const g = Number.parseInt(hex.substring(2, 4), 16);
		const b = Number.parseInt(hex.substring(4, 6), 16);
		// Lighten by mixing with white (70% track color + 30% white)
		const lighten = (c: number) => Math.round(c * 0.7 + 255 * 0.3);
		return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
	})();

	return (
		<>
			<svg
				ref={svgRef}
				className="pointer-events-auto absolute inset-0"
				width={trackWidth}
				height={trackHeight}
				style={{ zIndex: 10 }}
				aria-label={`Volume automation for ${track.name}`}
				onDoubleClick={handleSvgDoubleClick}
			>
				<title>{`Volume automation: ${sorted.length} points (double-click to add)`}</title>
				{/* Automation curve path */}
				<path
					d={path}
					fill="none"
					stroke={automationColor}
					strokeWidth={2}
					strokeOpacity={0.85}
					vectorEffect="non-scaling-stroke"
				/>

				{/* Interactive segments for curve type selection */}
				{sorted.map((point, index) => {
					if (index === 0) return null; // No segment before first point

					const prevPoint = sorted[index - 1];
					const x1 = prevPoint.time * pxPerMs;
					const y1 =
						trackHeight -
						padding -
						(Math.max(0, Math.min(4, prevPoint.value)) / 4) * usableHeight;
					const x2 = point.time * pxPerMs;
					const y2 =
						trackHeight -
						padding -
						(Math.max(0, Math.min(4, point.value)) / 4) * usableHeight;

					// Create a thick invisible path for easier clicking
					return (
						// biome-ignore lint/a11y/noStaticElementInteractions: SVG element with context menu for curve type selection
						<g
							key={`segment-${prevPoint.id}-${point.id}`}
							onContextMenu={(e) =>
								handleSegmentContextMenu(prevPoint.id, point.id, e)
							}
							className="cursor-context-menu"
							aria-label={`Automation segment from ${prevPoint.time}ms to ${point.time}ms - Right click to change curve type`}
						>
							<line
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
								stroke="transparent"
								strokeWidth={12}
								style={{ pointerEvents: "stroke" }}
							/>
							<title>Right-click to change curve type</title>
						</g>
					);
				})}

				{/* Automation points (draggable) */}
				{sorted.map((point) => {
					const x = point.time * pxPerMs;
					const normalizedValue = Math.max(0, Math.min(4, point.value)) / 4;
					const y = trackHeight - padding - normalizedValue * usableHeight;
					const envelopeDb = multiplierToDb(point.value);
					const effectiveDb = getEffectiveDb(track.volume, point.value);

					return (
						<g
							key={point.id}
							onPointerDown={(e) => handlePointPointerDown(point, e)}
							onPointerMove={handlePointerMove}
							onPointerUp={handlePointerUp}
							className="cursor-move"
						>
							{/* Hit area (larger, invisible) */}
							<circle
								cx={x}
								cy={y}
								r={10}
								fill="transparent"
								className="pointer-events-auto"
							/>
							{/* Visual point */}
							<circle
								cx={x}
								cy={y}
								r={4}
								fill={automationColor}
								stroke={track.color}
								strokeWidth={2}
								className="pointer-events-none"
							/>
							{/* Tooltip on hover */}
							<title>
								{`Time: ${(point.time / 1000).toFixed(2)}s, Envelope: ${envelopeDb.toFixed(1)} dB, Effective: ${effectiveDb.toFixed(1)} dB`}
							</title>
						</g>
					);
				})}

				{/* Playhead indicator on curve */}
				{playback.isPlaying && playheadX !== null && playheadY !== null && (
					<circle
						cx={playheadX}
						cy={playheadY}
						r={5}
						fill="rgb(239, 68, 68)" // red-500
						stroke="white"
						strokeWidth={2}
						className="pointer-events-none"
						style={{ filter: "drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))" }}
					/>
				)}
			</svg>
			{/* Curve type context menu - rendered as portal */}
			{selectedSegment &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed"
						style={{
							left: selectedSegment.x,
							top: selectedSegment.y,
							zIndex: 9999,
						}}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => {
							if (e.key === "Escape") setSelectedSegment(null);
						}}
						role="menu"
						aria-label="Curve type menu"
					>
						<div className="rounded-lg border border-border bg-popover p-1 shadow-xl">
							<div className="text-xs font-medium text-muted-foreground px-2 py-1 border-b border-border/50 mb-1">
								Curve Type
							</div>
							<button
								type="button"
								onClick={() => setCurveType("linear")}
								className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
							>
								<span className="text-xs opacity-50">—</span>
								<span>Linear</span>
							</button>
							<button
								type="button"
								onClick={() => setCurveType("easeIn")}
								className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
							>
								<span className="text-xs opacity-50">↗</span>
								<span>Ease In</span>
							</button>
							<button
								type="button"
								onClick={() => setCurveType("easeOut")}
								className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
							>
								<span className="text-xs opacity-50">↘</span>
								<span>Ease Out</span>
							</button>
							<button
								type="button"
								onClick={() => setCurveType("sCurve")}
								className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
							>
								<span className="text-xs opacity-50">~</span>
								<span>S-Curve</span>
							</button>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
