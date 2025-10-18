"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarkerTrack } from "@/components/daw/panels/marker-track";
import {
	addMarkerAtom,
	gridAtom,
	markersAtom,
	musicalMetadataAtom,
	playbackAtom,
	playheadViewportPxAtom,
	projectEndOverrideAtom,
	projectEndPositionAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
	timelineWidthAtom,
	updateMarkerAtom,
} from "@/lib/daw-sdk";
import { useTimebase } from "@/lib/daw-sdk/hooks/use-timebase";
import { snapTimeMs } from "@/lib/daw-sdk/utils/time-utils";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWTimeline() {
	const [timeline] = useAtom(timelineAtom);
	const [playback] = useAtom(playbackAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [_projectEndOverride, setProjectEndOverride] = useAtom(
		projectEndOverrideAtom,
	);
	const containerRef = useRef<HTMLButtonElement>(null);
	const [isDraggingEnd, setIsDraggingEnd] = useState(false);
	const [playheadViewportPx] = useAtom(playheadViewportPxAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [_markers] = useAtom(markersAtom);
	const [_updateMarker] = useAtom(updateMarkerAtom);
	const [, addMarker] = useAtom(addMarkerAtom);
	const [grid] = useAtom(gridAtom);
	const [music] = useAtom(musicalMetadataAtom);
    const { grid: tGrid, getGridSubdivisions } = useTimebase();

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
	const _timelinePlayheadViewport = playheadViewportPx;

	// Calculate time markers (time mode)
	const getTimeMarkers = () => {
		if (pxPerMs <= 0) return [];
		const markers = [];
		const pixelsPerSecond = pxPerMs * 1000;
		const secondsPerMarker =
			timeline.zoom < 0.5 ? 10 : timeline.zoom < 1 ? 5 : 1;

		for (
			let time = 0;
			time * pixelsPerSecond < timelineWidth;
			time += secondsPerMarker
		) {
			const timestampMs = time * 1000;
			markers.push({
				time: timestampMs,
				position: time * pixelsPerSecond,
				label: formatDuration(timestampMs),
			});
		}

		return markers;
	};

	// Calculate beat markers (bars mode) using musical metadata
	const getBeatMarkers = () => {
		if (pxPerMs <= 0) return [];
		const markers = [];
		const beatsPerMinute = music.tempoBpm;
		const secondsPerBeat =
			(60 / beatsPerMinute) * (4 / music.timeSignature.den);
		const pixelsPerBeat = secondsPerBeat * pxPerMs * 1000;

		for (let beat = 0; beat * pixelsPerBeat < timelineWidth; beat++) {
			const time = beat * secondsPerBeat;
			markers.push({
				beat,
				time: time * 1000,
				position: beat * pixelsPerBeat,
				isMeasure: beat % music.timeSignature.num === 0,
			});
		}

		return markers;
	};

	const handleTimelineClick = (e: React.MouseEvent | React.PointerEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (pxPerMs <= 0) return;

		// Allow clicking past project end; snap playhead and move if needed

		// Snap-to-grid (quarter note)
		const secondsPerBeat = 60 / playback.bpm;
		const snapSeconds = secondsPerBeat / 4; // 16th grid
		const rawSeconds = x / (pxPerMs * 1000);
		const snappedSeconds = timeline.snapToGrid
			? Math.round(rawSeconds / snapSeconds) * snapSeconds
			: rawSeconds;
		const time = snappedSeconds * 1000; // ms
		setCurrentTime(Math.max(0, time));
	};

	// Add marker at playhead on key "m"
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() !== "m") return;
			const timeMs = Math.max(0, Math.round(playback.currentTime));
			const snapped = snapTimeMs(
				timeMs,
				grid,
				music.tempoBpm,
				music.timeSignature,
			);
			addMarker({ timeMs: snapped, name: "", color: "#ffffff" });
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		addMarker,
		grid,
		music.tempoBpm,
		music.timeSignature,
		playback.currentTime,
	]);

	const onTimelinePointerDown = (
		event: React.PointerEvent<HTMLButtonElement>,
	) => {
		if (event.button !== 0) return;
		event.preventDefault();
		handleTimelineClick(event);
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
			onPointerDown={onTimelinePointerDown}
			style={{ width: timelineWidth }}
			aria-label="Timeline - click to set playback position"
		>
            {/* Grids */}
            {tGrid.mode === "bars"
                ? getGridSubdivisions(timelineWidth, pxPerMs).map((g) => (
                        <div
                            key={`${g.timeMs}-${g.posPx}`}
                            className={`absolute top-0 bottom-0 ${
                                g.emphasis === "measure"
                                    ? "w-0.5 bg-border"
                                    : g.emphasis === "beat"
                                    ? "w-px bg-border/70"
                                    : "w-px bg-border/40"
                            }`}
                            style={{ left: g.posPx }}
                        />
                  ))
                : timeMarkers.map((marker) => (
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

			{/* Project markers track */}
			<MarkerTrack pxPerMs={pxPerMs} width={timelineWidth} />

			{/* Project end marker and buffer zone */}
			<div
				className="absolute top-0 bottom-0 w-px bg-yellow-500/70 z-30"
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
