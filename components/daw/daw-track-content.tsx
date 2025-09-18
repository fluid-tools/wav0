"use client";

import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
	DAW_PIXELS_PER_SECOND_AT_ZOOM_1,
	DAW_ROW_HEIGHT,
} from "@/lib/constants";
import {
	selectedTrackIdAtom,
	timelineAtom,
	tracksAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWTrackContent() {
	const [tracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [timeline] = useAtom(timelineAtom);
	const [resizing, setResizing] = useState<{
		trackId: string;
		type: "start" | "end";
		startX: number;
		startValue: number;
	} | null>(null);

	const containerRef = useRef<HTMLDivElement>(null);

	const pixelsPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * timeline.zoom) / 1000; // px/ms

	const handleTrackDrop = async (trackId: string, e: React.DragEvent) => {
		e.preventDefault();

		const files = Array.from(e.dataTransfer.files).filter((file) =>
			file.type.startsWith("audio/"),
		);

		if (files.length === 0) return;

		const file = files[0];
		const arrayBuffer = await file.arrayBuffer();

		// Calculate drop position
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const startTime = x / pixelsPerMs;

		// Create a basic audio context to get duration
		const audioContext = new AudioContext();
		try {
			const audioBuffer = await audioContext.decodeAudioData(
				arrayBuffer.slice(0),
			);
			const duration = audioBuffer.duration * 1000; // Convert to ms

			updateTrack(trackId, {
				audioBuffer: arrayBuffer,
				duration,
				startTime,
				trimStart: 0,
				trimEnd: duration,
				name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
			});
		} catch (error) {
			console.error("Error loading audio file:", error);
		} finally {
			audioContext.close();
		}
	};

	const handleResizeStart = (
		trackId: string,
		type: "start" | "end",
		e: React.MouseEvent,
	) => {
		e.preventDefault();
		e.stopPropagation();

		const track = tracks.find((t) => t.id === trackId);
		if (!track) return;

		setResizing({
			trackId,
			type,
			startX: e.clientX,
			startValue: type === "start" ? track.trimStart : track.trimEnd,
		});
	};

	// Attach document-level pointer listeners while resizing
	useEffect(() => {
		if (!resizing) return;
		const onMove = (e: MouseEvent) => {
			const deltaX = e.clientX - resizing.startX;
			const deltaTime = deltaX / pixelsPerMs;

			const track = tracks.find((t) => t.id === resizing.trackId);
			if (!track) return;

			if (resizing.type === "start") {
				const newTrimStart = Math.max(
					0,
					Math.min(resizing.startValue + deltaTime, track.trimEnd - 100),
				);
				updateTrack(resizing.trackId, { trimStart: newTrimStart });
			} else {
				const newTrimEnd = Math.min(
					track.duration,
					Math.max(resizing.startValue + deltaTime, track.trimStart + 100),
				);
				updateTrack(resizing.trackId, { trimEnd: newTrimEnd });
			}
		};
		const onUp = () => setResizing(null);

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [resizing, pixelsPerMs, tracks, updateTrack]);

	return (
		<div ref={containerRef} className="relative w-full h-full">
			{tracks.map((track, index) => {
				const trackY = index * DAW_ROW_HEIGHT;
				const trackWidth = (track.trimEnd - track.trimStart) * pixelsPerMs;
				const trackX = (track.startTime + track.trimStart) * pixelsPerMs;

				return (
					<div
						key={track.id}
						className="absolute border-b border-border/50"
						style={{
							top: trackY,
							height: DAW_ROW_HEIGHT,
							left: 0,
							right: 0,
							padding: '12px',
						}}
					>
						{/* Track Drop Zone */}
						<button
							type="button"
							className="absolute inset-0 w-full h-full bg-transparent border-none p-0 cursor-default"
							onDrop={(e) => handleTrackDrop(track.id, e)}
							onDragOver={(e) => e.preventDefault()}
							style={{ padding: '12px' }}
							aria-label={`Track ${track.name} drop zone`}
						>
							{/* Track Audio Clip */}
							{track.duration > 0 && (
								<button
									type="button"
									className={`absolute top-0 bottom-0 rounded-md border-2 transition-all cursor-pointer select-none ${
										selectedTrackId === track.id
											? "border-primary bg-primary/20"
											: "border-border bg-muted/50 hover:bg-muted/70"
									} ${track.muted ? "opacity-50" : ""}`}
									style={{
										left: trackX,
										width: Math.max(trackWidth, 20),
										backgroundColor: `${track.color}20`,
										borderColor: track.color,
									}}
									onClick={() => setSelectedTrackId(track.id)}
									aria-label={`Select audio clip: ${track.name}`}
								>
									{/* Resize Handles */}
									<button
										className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-primary/50 opacity-0 hover:opacity-100 border-none p-0"
										onMouseDown={(e) => handleResizeStart(track.id, "start", e)}
										type="button"
										aria-label="Resize track start"
									/>
									<button
										className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-primary/50 opacity-0 hover:opacity-100 border-none p-0"
										onMouseDown={(e) => handleResizeStart(track.id, "end", e)}
										type="button"
										aria-label="Resize track end"
									/>

								{/* Track Label */}
								<div className="absolute inset-2 flex flex-col justify-center">
									<div className="text-xs font-medium truncate text-left">
										{track.name}
									</div>
									<div className="text-xs text-muted-foreground text-left">
										{formatDuration((track.trimEnd - track.trimStart) / 1000)}
									</div>
								</div>

									{/* Waveform placeholder */}
									<div className="absolute bottom-1 left-2 right-2 h-4 bg-current opacity-20 rounded-sm" />
								</button>
							)}

							{/* Drop Zone Indicator */}
							{track.duration === 0 && (
								<div className="absolute inset-0 border-2 border-dashed border-muted-foreground/30 rounded-md flex items-center justify-center text-muted-foreground text-sm">
									Drop audio file here
								</div>
							)}
						</button>
					</div>
				);
			})}

			{/* Grid Lines */}
			<div className="absolute inset-0 pointer-events-none">
				{Array.from({ length: Math.ceil(2000 / 100) }).map((_, i) => (
					<div
						key={`grid-line-${i * 100}`}
						className="absolute top-0 bottom-0 w-px bg-border/20"
						style={{ left: i * 100 }}
					/>
				))}
			</div>
		</div>
	);
}