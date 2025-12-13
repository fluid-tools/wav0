"use client";

import {
	automationViewEnabledAtom,
	horizontalScrollAtom,
	isPlayingAtom,
	timelinePxPerMsAtom,
	updateTrackAtom,
	useDAWContext,
} from "@wav0/daw-react";
import type { Track, TrackEnvelopePoint } from "@wav0/daw-sdk";
import { curves, volume } from "@wav0/daw-sdk";
import { automation } from "@wav0/daw-sdk/utils";
import { useAtom } from "jotai";
import { memo, useEffect, useRef, useState } from "react";
import { AutomationContextMenu } from "@/components/daw/context-menus/automation-context-menu";

const {
	resolveClipRelativePoint,
	migrateAutomationToSegments,
	addAutomationPoint,
} = automation;

function resolveAutomationPoints(
	points: TrackEnvelopePoint[] | undefined,
	clips: Track["clips"] | undefined,
) {
	if (!points || points.length === 0) return [];
	const clipStarts =
		clips && clips.length > 0
			? new Map(clips.map((clip) => [clip.id, clip.startTime]))
			: null;
	return points
		.map((point) =>
			point.clipId && clipStarts?.has(point.clipId)
				? resolveClipRelativePoint(point, clipStarts.get(point.clipId) ?? 0)
				: point,
		)
		.sort((a, b) => a.time - b.time);
}
type AutomationLaneProps = {
	track: Track;
	trackHeight: number;
	trackWidth: number;
};

export const AutomationLane = memo(function AutomationLane({
	track,
	trackHeight,
	trackWidth,
}: AutomationLaneProps) {
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	// Use fine-grained atoms to avoid re-renders on every time update
	const [isPlaying] = useAtom(isPlayingAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const daw = useDAWContext();
	// Direct Transport subscription for playhead position (no React state)
	const playheadIndicatorRef = useRef<SVGCircleElement>(null);
	const currentTimeRef = useRef(daw?.getTransport().getCurrentTime() ?? 0);
	const [automationViewEnabled] = useAtom(automationViewEnabledAtom);
	const [_horizontalScroll] = useAtom(horizontalScrollAtom);
	const [draggingPoint, setDraggingPoint] = useState<{
		pointId: string;
		startX: number;
		startY: number;
		startTime: number;
		startValue: number;
		pointerId: number;
	} | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const isDraggingRef = useRef(false);

	// Auto-migrate envelope on render
	const envelope = track.volumeEnvelope
			? migrateAutomationToSegments(track.volumeEnvelope)
		: null;

	const handlePointPointerDown = (point: TrackEnvelopePoint, e: React.PointerEvent) => {
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
			window.dispatchEvent(new CustomEvent("wav0:automation-drag-start"));
	};

	const handlePointerMove = (e: React.PointerEvent) => {
			if (!draggingPoint || !isDraggingRef.current) return;
			if (e.pointerId !== draggingPoint.pointerId) return;

			e.preventDefault();
			e.stopPropagation();

			const padding = 20;
			const usableHeight = trackHeight - padding * 2;

			const deltaY = e.clientY - draggingPoint.startY;
		const deltaValue = -(deltaY / usableHeight) * 4;
		const newValue = Math.max(0, Math.min(4, draggingPoint.startValue + deltaValue));

			const deltaX = e.clientX - draggingPoint.startX;
			const deltaTime = deltaX / pxPerMs;
			const newTime = Math.max(0, draggingPoint.startTime + deltaTime);

			const clipStartTimeMap = new Map<string, number>(
				(track.clips ?? []).map((c) => [c.id, c.startTime]),
			);

			if (!envelope) return;
			const updatedPoints = envelope.points.map((p) => {
				if (p.id !== draggingPoint.pointId) return p;

				if (p.clipId) {
					const clipExists = clipStartTimeMap.has(p.clipId);
					if (!clipExists) {
						const { clipId: _, clipRelativeTime: __, ...rest } = p;
						return { ...rest, value: newValue, time: newTime };
					}
					const clipStartTime = clipStartTimeMap.get(p.clipId) ?? 0;
				return { ...p, value: newValue, time: newTime, clipRelativeTime: newTime - clipStartTime };
				}

			return { ...p, value: newValue, time: newTime };
			});

		updateTrack(track.id, { volumeEnvelope: { ...envelope, points: updatedPoints } });
	};

	const handlePointerUp = (e: React.PointerEvent) => {
			if (draggingPoint && e.pointerId === draggingPoint.pointerId) {
				isDraggingRef.current = false;
				setDraggingPoint(null);
				window.dispatchEvent(new CustomEvent("wav0:automation-drag-end"));
			}
	};

	const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
			if (!svgRef.current || !envelope) return;

			const isCmdCtrlClick = e.metaKey || e.ctrlKey;
			const isDoubleClick = e.detail === 2;
			if (!isCmdCtrlClick && !isDoubleClick) return;

			const rect = svgRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			const time = x / pxPerMs;
			const padding = 20;
			const usableHeight = trackHeight - padding * 2;
			const normalizedY = (trackHeight - padding - y) / usableHeight;
			const value = Math.max(0, Math.min(4, normalizedY * 4));

			const newPoint: TrackEnvelopePoint = {
				id: `point-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
				time,
				value,
			};

			const updatedEnvelope = addAutomationPoint(envelope, newPoint);
		updateTrack(track.id, { volumeEnvelope: updatedEnvelope });
	};

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

	const padding = 20;
	const usableHeight = trackHeight - padding * 2;

	// Resolve clip-relative points to absolute time for rendering (compiler-friendly helper)
	const sorted = resolveAutomationPoints(envelope?.points, track.clips);

	// SVG path generation - compiler handles memoization
	const path = (() => {
		if (sorted.length === 0) return "";

		const multiplierToY = (multiplier: number): number => {
			const normalizedValue = Math.max(0, Math.min(4, multiplier)) / 4;
			return trackHeight - padding - normalizedValue * usableHeight;
		};

		const points = sorted.map((point) => {
			const x = point.time * pxPerMs;
			const y = multiplierToY(point.value);
			return { x, y, point };
		});

		let pathData = `M ${points[0].x} ${points[0].y}`;

		for (let i = 1; i < points.length; i++) {
			const prev = points[i - 1];
			const curr = points[i];

			const segment = envelope?.segments?.find(
				(s) => s.fromPointId === prev.point.id && s.toPointId === curr.point.id,
			);
			const curve = segment?.curve ?? 0;

			if (curve === 0) {
				pathData += ` L ${curr.x} ${curr.y}`;
			} else {
				const samples = 20;
				const deltaX = curr.x - prev.x;

				for (let s = 1; s <= samples; s++) {
					const t = s / samples;
					const curveValue = curves.evaluateSegmentCurve(prev.point.value, curr.point.value, t, curve);
					const normalizedValue = curveValue / 4;
					const x = prev.x + deltaX * t;
					const y = trackHeight - padding - normalizedValue * usableHeight;
					pathData += ` L ${x} ${y}`;
				}
			}
		}

		return pathData;
	})();

	// Store metrics in refs for Transport callback
	const metricsRef = useRef({ pxPerMs, sorted, trackHeight, usableHeight });
	useEffect(() => {
		metricsRef.current = { pxPerMs, sorted, trackHeight, usableHeight };
	}, [pxPerMs, sorted, trackHeight, usableHeight]);

	// Subscribe directly to Transport time-update for playhead indicator
	// Updates DOM directly without React re-renders
	useEffect(() => {
		if (!daw || !isPlaying) {
			// Hide indicator when not playing
			if (playheadIndicatorRef.current) {
				playheadIndicatorRef.current.style.display = "none";
			}
			return;
		}

		const transport = daw.getTransport();

		const handleTimeUpdate = (event: CustomEvent<{ currentTime: number }>) => {
			const timeMs = event.detail.currentTime;
			currentTimeRef.current = timeMs;

			if (!playheadIndicatorRef.current) return;

			const { pxPerMs: px, sorted: pts, trackHeight: th, usableHeight: uh } = metricsRef.current;
			const padding = 20;

			// Calculate X position
			const x = timeMs * px;

			// Find current multiplier at playhead
			let currentMultiplier = 1.0;
			for (const point of pts) {
				if (point.time <= timeMs) {
					currentMultiplier = point.value;
				} else {
					break;
				}
			}
			const normalizedValue = Math.max(0, Math.min(4, currentMultiplier)) / 4;
			const y = th - padding - normalizedValue * uh;

			// Direct DOM update
			playheadIndicatorRef.current.style.display = "";
			playheadIndicatorRef.current.setAttribute("cx", String(x));
			playheadIndicatorRef.current.setAttribute("cy", String(y));
		};

		// Initial position
		const initialTime = transport.getCurrentTime();
		handleTimeUpdate({ detail: { currentTime: initialTime } } as CustomEvent<{ currentTime: number }>);

		transport.addEventListener("time-update", handleTimeUpdate as EventListener);

		return () => {
			transport.removeEventListener("time-update", handleTimeUpdate as EventListener);
		};
	}, [daw, isPlaying]);

	// Don't render if automation view disabled
	if (!automationViewEnabled) {
		return null;
	}

	// Don't render if automation disabled or no points
	if (!envelope?.enabled || !envelope.points || envelope.points.length === 0) {
		return null;
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
		<AutomationContextMenu
			track={track}
			trackHeight={trackHeight}
			pxPerMs={pxPerMs}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Click requires mouse coordinates; keyboard access via context menu */}
			<svg
				ref={svgRef}
				className="pointer-events-auto absolute inset-0"
				width={trackWidth}
				height={trackHeight}
				style={{ zIndex: 10 }}
				aria-label={`Volume automation for ${track.name}`}
				onClick={handleSvgClick}
			>
				<title>{`Volume automation: ${sorted.length} points (Cmd/Ctrl+Click or double-click to add)`}</title>

				{/* Clip fade overlays (non-interactive, view-only) */}
				{track.clips?.map((clip) => {
					const clipStartPx = clip.startTime * pxPerMs;
					const clipDurationMs = clip.trimEnd - clip.trimStart;
					const clipEndPx = clipStartPx + clipDurationMs * pxPerMs;

					const fadeInMs = Math.max(clip.fadeIn ?? 0, 0);
					const fadeOutMs = Math.max(clip.fadeOut ?? 0, 0);

					if (fadeInMs === 0 && fadeOutMs === 0) return null;

					return (
						<g key={`fade-${clip.id}`}>
							{/* Fade In */}
							{fadeInMs > 0 && (
								<rect
									x={clipStartPx}
									y={padding}
									width={fadeInMs * pxPerMs}
									height={usableHeight}
									fill="rgba(34, 197, 94, 0.15)"
									opacity={0.5}
									className="pointer-events-none"
								>
									<title>
										Fade in: {(fadeInMs / 1000).toFixed(2)}s (edit via fade
										handles)
									</title>
								</rect>
							)}

							{/* Fade Out */}
							{fadeOutMs > 0 && (
								<rect
									x={clipEndPx - fadeOutMs * pxPerMs}
									y={padding}
									width={fadeOutMs * pxPerMs}
									height={usableHeight}
									fill="rgba(239, 68, 68, 0.15)"
									opacity={0.5}
									className="pointer-events-none"
								>
									<title>
										Fade out: {(fadeOutMs / 1000).toFixed(2)}s (edit via fade
										handles)
									</title>
								</rect>
							)}
						</g>
					);
				})}

				{/* Automation curve path */}
				<path
					d={path}
					fill="none"
					stroke={automationColor}
					strokeWidth={2}
					strokeOpacity={0.85}
					vectorEffect="non-scaling-stroke"
				/>

				{/* Note: Segment curves are now edited in the clip drawer, not here */}

				{/* Automation points (draggable) */}
				{sorted.map((point) => {
					const x = point.time * pxPerMs;
					const normalizedValue = Math.max(0, Math.min(4, point.value)) / 4;
					const y = trackHeight - padding - normalizedValue * usableHeight;
					const envelopeDb = volume.multiplierToDb(point.value);
					const effectiveDb = volume.getEffectiveDb(
						track.volume ?? 75,
						point.value,
					);

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

				{/* Playhead indicator on curve - updated via ref during playback */}
				<circle
					ref={playheadIndicatorRef}
					r={5}
					fill="rgb(239, 68, 68)" // red-500
					stroke="white"
					strokeWidth={2}
					className="pointer-events-none"
					style={{ display: isPlaying ? "" : "none", filter: "drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))" }}
				/>
			</svg>
		</AutomationContextMenu>
	);
});
