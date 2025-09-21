"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import {
	horizontalScrollAtom,
	playbackAtom,
	setCurrentTimeAtom,
	timelineAtom,
	totalDurationAtom,
} from "@/lib/state/daw-store";

type DAWPlayheadProps = {
	containerRef?: React.RefObject<HTMLDivElement | null>;
};

export function DAWPlayhead({ containerRef }: DAWPlayheadProps) {
	const [playback] = useAtom(playbackAtom);
	const [timeline] = useAtom(timelineAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const [totalDuration] = useAtom(totalDurationAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [isDragging, setIsDragging] = useState(false);
	const playheadRef = useRef<HTMLDivElement>(null);

	// Calculate playhead position
	const playheadPosition =
		(playback.currentTime / 1000) *
		timeline.zoom *
		DAW_PIXELS_PER_SECOND_AT_ZOOM_1;
	const viewportPosition = playheadPosition - horizontalScroll;

	// Handle playhead dragging
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging || !containerRef?.current) return;

			const rect = containerRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left + horizontalScroll;
			const pixelsPerSecond = timeline.zoom * DAW_PIXELS_PER_SECOND_AT_ZOOM_1;

			// Snap-to-grid if enabled
			const rawSeconds = x / pixelsPerSecond;
			let snappedSeconds = rawSeconds;

			if (timeline.snapToGrid) {
				const secondsPerBeat = 60 / playback.bpm;
				const snapSeconds = secondsPerBeat / 4; // 16th grid
				snappedSeconds = Math.round(rawSeconds / snapSeconds) * snapSeconds;
			}

			// Clamp to project duration (don't allow past yellow marker)
			const maxSeconds = totalDuration / 1000;
			const clampedSeconds = Math.min(Math.max(0, snappedSeconds), maxSeconds);
			const time = clampedSeconds * 1000;
			setCurrentTime(time);
		},
		[
			isDragging,
			containerRef,
			horizontalScroll,
			timeline,
			playback.bpm,
			totalDuration,
			setCurrentTime,
		],
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// Attach global mouse events for dragging
	useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "ew-resize";
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
		};
	}, [isDragging, handleMouseMove, handleMouseUp]);

	// Only render if visible in viewport (client-side only)
	if (
		typeof window !== "undefined" &&
		(viewportPosition < -10 || viewportPosition > window.innerWidth)
	) {
		return null;
	}

	return (
		<div
			ref={playheadRef}
			className={`absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 cursor-ew-resize ${
				isDragging ? "bg-red-400" : "bg-red-500"
			}`}
			style={{
				left: viewportPosition,
				userSelect: "none",
			}}
			onMouseDown={handleMouseDown}
			role="slider"
			tabIndex={0}
			aria-label="Playhead position"
			aria-valuemin={0}
			aria-valuemax={totalDuration}
			aria-valuenow={playback.currentTime}
		>
			{/* Playhead handle */}
			<div
				className={`w-3 h-3 rounded-sm -ml-1.5 transition-colors ${
					isDragging ? "bg-red-400" : "bg-red-500"
				}`}
				style={{
					cursor: "ew-resize",
				}}
			/>
		</div>
	);
}
