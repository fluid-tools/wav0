"use client";

import { useAtom } from "jotai";
import {
	playbackAtom,
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

	// Calculate time markers based on zoom and BPM
	const getTimeMarkers = () => {
		const markers = [];
		const pixelsPerSecond = timeline.zoom * 100; // 100px per second at zoom 1
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
		const pixelsPerSecond = timeline.zoom * 100;
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
		const pixelsPerSecond = timeline.zoom * 100;
		const time = (x / pixelsPerSecond) * 1000; // Convert to ms
		setCurrentTime(time);
	};

	const timeMarkers = getTimeMarkers();
	const beatMarkers = getBeatMarkers();
	const playheadPosition = (playback.currentTime / 1000) * timeline.zoom * 100;

	return (
		<button
			type="button"
			className="h-full w-full relative bg-muted/10 cursor-pointer select-none border-none p-0"
			onClick={handleTimelineClick}
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

			{/* Playhead */}
			<div
				className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
				style={{ left: playheadPosition }}
			>
				<div className="w-3 h-3 bg-primary -ml-1.5 rounded-sm" />
			</div>

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
