"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarkerTrack } from "@/components/daw/panels/marker-track";
import { TimelineGridCanvas } from "@/components/daw/panels/timeline-grid-canvas";
import { UnifiedOverlay } from "@/components/daw/unified-overlay";
import {
	addMarkerAtom,
	playbackAtom,
	projectEndOverrideAtom,
	projectEndPositionAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
	timelineWidthAtom,
	horizontalScrollAtom,
} from "@/lib/daw-sdk";
import { useTimebase } from "@/lib/daw-sdk/hooks/use-timebase";

export function DAWTimeline() {
	const [timeline] = useAtom(timelineAtom);
	const [playback] = useAtom(playbackAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [_projectEndOverride, setProjectEndOverride] = useAtom(
		projectEndOverrideAtom,
	);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isDraggingEnd, setIsDraggingEnd] = useState(false);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const [, addMarker] = useAtom(addMarkerAtom);
	const { snap } = useTimebase();

	// legacy marker drag removed in favor of dedicated MarkerTrack

	const onMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDraggingEnd || !containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const ms = Math.max(0, Math.round(x / pxPerMs));
			setProjectEndOverride(ms);
		},
		[isDraggingEnd, pxPerMs, setProjectEndOverride],
	);

	useEffect(() => {
		if (!isDraggingEnd) return;
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", () => setIsDraggingEnd(false), {
			once: true,
		});
		return () => {
			document.removeEventListener("mousemove", onMouseMove);
		};
	}, [isDraggingEnd, onMouseMove]);

	const handleTimelineClick = (e: React.MouseEvent | React.PointerEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (pxPerMs <= 0) return;

		// x is viewport position relative to DAWTimeline's visible left edge
		// Add horizontalScroll to get absolute timeline position
		const absoluteX = Math.max(0, x + horizontalScroll);
		const rawMs = Math.max(0, absoluteX / pxPerMs);
		const timeMs = timeline.snapToGrid ? snap(rawMs) : rawMs;
		setCurrentTime(timeMs);
	};

	// Add marker at playhead on key "m"
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// Ignore if typing in an input or if modifier keys are pressed
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.tagName === "SELECT" ||
				target.isContentEditable ||
				e.metaKey ||
				e.ctrlKey ||
				e.altKey ||
				e.shiftKey
			) {
				return;
			}
			if (e.key.toLowerCase() !== "m") return;
			const timeMs = Math.max(0, playback.currentTime);
			const snapped = snap(timeMs);
			addMarker({ timeMs: snapped, name: "", color: "#ffffff" });
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [addMarker, snap, playback.currentTime]);

	const onTimelinePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		event.preventDefault();
		handleTimelineClick(event);
	};

	return (
		<div
			ref={containerRef}
			className="h-full w-full relative bg-muted/10"
			style={{ width: timelineWidth }}
		>
			{/* Visual layer - non-interactive */}
			{/* Always use TimelineGridCanvas - it handles both time and bars mode with proper snap alignment */}
			<div className="absolute inset-0 pointer-events-none z-0">
				<TimelineGridCanvas width={timelineWidth} height={400} />
			</div>

			{/* Playhead overlay - positioned relative to scroll container for perfect sync */}
			<div className="absolute inset-0 pointer-events-none z-15">
				<UnifiedOverlay />
			</div>

			{/* Timeline click layer - interactive background */}
			{/* biome-ignore lint/a11y/useSemanticElements: Cannot use button element as it would create nested interactive elements with MarkerTrack buttons and project end slider */}
			<div
				className="absolute inset-0 cursor-pointer z-10"
				role="button"
				tabIndex={0}
				onClick={(e) => {
					if (isDraggingEnd) return;
					handleTimelineClick(e);
				}}
				onKeyDown={(e) => {
					if (isDraggingEnd) return;
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						const at = Math.max(0, playback.currentTime);
						const snapped = timeline.snapToGrid ? snap(at) : at;
						setCurrentTime(snapped);
					}
				}}
				onPointerDown={onTimelinePointerDown}
				aria-label="Timeline - click to set playback position"
			/>

			{/* Markers layer - higher priority */}
			<div className="absolute inset-0 pointer-events-none z-20">
				<div className="pointer-events-auto">
					<MarkerTrack pxPerMs={pxPerMs} width={timelineWidth} />
				</div>
			</div>

			{/* Project end slider - highest priority */}
			<div
				className="absolute top-0 bottom-0 w-px bg-yellow-500/70 z-30 pointer-events-auto"
				style={{
					left: projectEndPosition,
					cursor: "ew-resize",
				}}
				tabIndex={0}
				title="Project End"
				role="slider"
				aria-label="Project end"
				aria-valuemin={0}
				aria-valuenow={Math.max(0, Math.round(projectEndPosition))}
				onMouseDown={(e) => {
					e.preventDefault();
					e.stopPropagation();
					setIsDraggingEnd(true);
				}}
			/>

			{/* Buffer/dead space overlay */}
			<div
				className="absolute top-0 bottom-0 bg-muted/20 pointer-events-none z-20"
				style={{
					left: projectEndPosition,
					right: 0,
				}}
			/>

			{/* Playhead is rendered in UnifiedOverlay to keep header + grid perfectly synchronized */}

			{/* Snap grid overlay */}
			{timeline.snapToGrid && (
				<div className="absolute inset-0 pointer-events-none z-5">
					{Array.from({ length: Math.ceil(timelineWidth / 25) }).map((_, i) => (
						<div
							key={`snap-grid-${i * 25}`}
							className="absolute top-0 bottom-0 w-px bg-primary/10"
							style={{ left: i * 25 }}
						/>
					))}
				</div>
			)}
		</div>
	);
}
