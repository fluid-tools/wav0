"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import {
	horizontalScrollAtom,
	playbackAtom,
	projectEndPositionAtom,
	projectEndOverrideAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelineWidthAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWTimeline() {
	const [timeline] = useAtom(timelineAtom);
	const [playback] = useAtom(playbackAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [projectEndOverride, setProjectEndOverride] = useAtom(
		projectEndOverrideAtom,
	);
	const containerRef = useRef<HTMLButtonElement>(null);
	const [isDraggingEnd, setIsDraggingEnd] = useState(false);

	const onMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDraggingEnd || !containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * timeline.zoom) / 1000;
			const ms = Math.max(0, Math.round(x / pxPerMs));
			setProjectEndOverride(ms);
		},
		[isDraggingEnd, timeline.zoom, setProjectEndOverride],
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
	const [horizontalScroll] = useAtom(horizontalScrollAtom);

	// Calculate timeline playhead position
	const timelinePlayheadPosition =
		(playback.currentTime / 1000) *
		timeline.zoom *
		DAW_PIXELS_PER_SECOND_AT_ZOOM_1;
	const timelinePlayheadViewport = timelinePlayheadPosition - horizontalScroll;

	// Calculate time markers based on zoom and BPM
	const getTimeMarkers = () => {
		const markers = [];
		const pixelsPerSecond = timeline.zoom * DAW_PIXELS_PER_SECOND_AT_ZOOM_1; // 100px per second at zoom 1
		const secondsPerMarker =
			timeline.zoom < 0.5 ? 10 : timeline.zoom < 1 ? 5 : 1;

		for (
			let time = 0;
			time * pixelsPerSecond < timelineWidth;
			time += secondsPerMarker
		) {
			markers.push({
				time: time * 1000, // Convert to ms
				position: time * pixelsPerSecond,
				label: formatDuration(time),
			});
		}

		return markers;
	};

	const getBeatMarkers = () => {
		const markers = [];
		const beatsPerMinute = playback.bpm;
		const secondsPerBeat = 60 / beatsPerMinute;
		const pixelsPerSecond = timeline.zoom * DAW_PIXELS_PER_SECOND_AT_ZOOM_1;
		const pixelsPerBeat = secondsPerBeat * pixelsPerSecond;

		for (let beat = 0; beat * pixelsPerBeat < timelineWidth; beat++) {
			const time = beat * secondsPerBeat;
			markers.push({
				beat,
				time: time * 1000,
				position: beat * pixelsPerBeat,
				isMeasure: beat % 4 === 0,
			});
		}

		return markers;
	};

	const handleTimelineClick = (e: React.MouseEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const pixelsPerSecond = timeline.zoom * DAW_PIXELS_PER_SECOND_AT_ZOOM_1;

		// Allow clicking past project end; snap playhead and move if needed

		// Snap-to-grid (quarter note)
		const secondsPerBeat = 60 / playback.bpm;
		const snapSeconds = secondsPerBeat / 4; // 16th grid
		const rawSeconds = x / pixelsPerSecond;
		const snappedSeconds = timeline.snapToGrid
			? Math.round(rawSeconds / snapSeconds) * snapSeconds
			: rawSeconds;
		const time = snappedSeconds * 1000; // ms
		setCurrentTime(Math.max(0, time));
	};

	// Playhead position calculation (now handled by DAWPlayhead component)

	const timeMarkers = getTimeMarkers();
	const beatMarkers = getBeatMarkers();

	return (
		<button
			ref={containerRef}
			type="button"
			className="h-full w-full relative bg-muted/10 cursor-pointer select-none border-none p-0"
			onClick={(e) => {
				if (isDraggingEnd) return;
				handleTimelineClick(e);
			}}
			style={{ width: timelineWidth }}
			aria-label="Timeline - click to set playback position"
		>
			{/* Beat markers */}
			{beatMarkers.map((marker) => (
				<div
					key={`beat-${marker.beat}`}
					className={`absolute top-0 bottom-0 ${
						marker.isMeasure ? "w-0.5 bg-border" : "w-px bg-border/50"
					}`}
					style={{ left: marker.position }}
				/>
			))}

			{/* Time markers */}
			{timeMarkers.map((marker) => (
				<div
					key={`time-${marker.time}`}
					className="absolute top-0"
					style={{ left: marker.position }}
				>
					<div className="w-px h-3 bg-foreground" />
					<span className="text-xs text-muted-foreground ml-1 font-mono">
						{marker.label}
					</span>
				</div>
			))}

			{/* Project end marker and buffer zone */}
			<div
				className="absolute top-0 bottom-0 w-px bg-yellow-500/70 z-30"
				style={{ left: projectEndPosition }}
				title="Project End"
				role="slider"
				aria-label="Project end"
				aria-valuemin={0}
				aria-valuenow={Math.max(0, Math.round(projectEndPosition))}
				onMouseDown={(e) => {
					e.preventDefault();
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

			{/* Timeline playhead indicator */}
			{timelinePlayheadViewport >= -2 &&
				timelinePlayheadViewport <= timelineWidth && (
					<div
						className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none"
						style={{ left: timelinePlayheadViewport }}
					>
						{/* Timeline playhead triangle indicator */}
						<div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-red-500" />
					</div>
				)}

			{/* Snap grid overlay */}
			{timeline.snapToGrid && (
				<div className="absolute inset-0 pointer-events-none">
					{Array.from({ length: Math.ceil(timelineWidth / 25) }).map((_, i) => (
						<div
							key={`snap-grid-${i * 25}`}
							className="absolute top-0 bottom-0 w-px bg-primary/10"
							style={{ left: i * 25 }}
						/>
					))}
				</div>
			)}
		</button>
	);
}
