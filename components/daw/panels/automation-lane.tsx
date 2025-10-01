"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { getEffectiveDb, multiplierToDb } from "@/lib/audio/volume";
import type { Track, TrackEnvelopePoint } from "@/lib/state/daw-store";
import {
	automationViewEnabledAtom,
	playbackAtom,
	timelinePxPerMsAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";

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
		startY: number;
		startValue: number;
	} | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);

	const envelope = track.volumeEnvelope;

	// Hooks must be called unconditionally
	const handlePointPointerDown = useCallback(
		(point: TrackEnvelopePoint, e: React.PointerEvent) => {
			e.stopPropagation();
			e.currentTarget.setPointerCapture(e.pointerId);
			setDraggingPoint({
				pointId: point.id,
				startY: e.clientY,
				startValue: point.value,
			});
		},
		[],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!draggingPoint || !svgRef.current) return;

			const padding = 20;
			const usableHeight = trackHeight - padding * 2;

			// Calculate delta Y and map to multiplier change
			const deltaY = e.clientY - draggingPoint.startY;
			const deltaValue = -(deltaY / usableHeight) * 4; // Inverted, scaled to 0-4 range

			const newValue = Math.max(
				0,
				Math.min(4, draggingPoint.startValue + deltaValue),
			);

			// Update point in envelope
			if (!envelope) return;
			const updatedPoints = envelope.points.map((p) =>
				p.id === draggingPoint.pointId ? { ...p, value: newValue } : p,
			);

			updateTrack(track.id, {
				volumeEnvelope: {
					...envelope,
					points: updatedPoints,
				},
			});
		},
		[draggingPoint, trackHeight, envelope, track.id, updateTrack],
	);

	const handlePointerUp = useCallback(() => {
		setDraggingPoint(null);
	}, []);

	// Lock scroll while dragging automation point
	useEffect(() => {
		if (!draggingPoint) return;

		const preventScroll = (e: Event) => {
			e.preventDefault();
		};

		// Prevent scroll on the grid container
		const gridContainer = document.querySelector("[data-daw-grid]");
		if (gridContainer) {
			gridContainer.addEventListener("wheel", preventScroll, {
				passive: false,
			});
		}

		return () => {
			if (gridContainer) {
				gridContainer.removeEventListener("wheel", preventScroll);
			}
		};
	}, [draggingPoint]);

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

	return (
		<svg
			ref={svgRef}
			className="pointer-events-auto absolute inset-0"
			width={trackWidth}
			height={trackHeight}
			style={{ zIndex: 10 }}
			aria-label={`Volume automation for ${track.name}`}
		>
			<title>{`Volume automation: ${sorted.length} points`}</title>
			{/* Automation curve path */}
			<path
				d={path}
				fill="none"
				stroke="rgb(251, 191, 36)" // amber-400
				strokeWidth={2}
				strokeOpacity={0.8}
				vectorEffect="non-scaling-stroke"
			/>

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
							fill="rgb(251, 191, 36)"
							stroke="rgb(245, 158, 11)" // amber-500
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
	);
}
