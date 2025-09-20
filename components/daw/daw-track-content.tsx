"use client";

import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import { DAW_HEIGHTS } from "@/lib/constants/daw-design";
import {
	loadAudioFileAtom,
	projectEndPositionAtom,
	selectedTrackIdAtom,
	selectedClipIdAtom,
	activeToolAtom,
	timelineAtom,
	trackHeightZoomAtom,
	tracksAtom,
	updateTrackAtom,
	updateClipAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWTrackContent() {
	const [tracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [selectedClipId, setSelectedClipId] = useAtom(selectedClipIdAtom);
	const [activeTool] = useAtom(activeToolAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);
	const [, loadAudioFile] = useAtom(loadAudioFileAtom);
	const [timeline] = useAtom(timelineAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);

	const [resizingClip, setResizingClip] = useState<{
		trackId: string;
		clipId: string;
		type: "start" | "end";
		startX: number;
		startTrimStart: number;
		startTrimEnd: number;
		startClipStartTime: number;
	} | null>(null);

	const [draggingClip, setDraggingClip] = useState<{
		trackId: string;
		clipId: string;
		startX: number;
		startTime: number;
	} | null>(null);

	const containerRef = useRef<HTMLDivElement>(null);
	const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

	const pixelsPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * timeline.zoom) / 1000; // px/ms

	const handleTrackDrop = async (trackId: string, e: React.DragEvent) => {
		e.preventDefault();
		setDragOverTrackId(null);

		const files = Array.from(e.dataTransfer.files).filter((file) =>
			file.type.startsWith("audio/"),
		);

		if (files.length === 0) return;

		const file = files[0];

		// Calculate drop position
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const startTime = x / pixelsPerMs;

		try {
			await loadAudioFile(file, trackId, { startTimeMs: startTime });
		} catch (error) {
			console.error("Error loading audio file:", error);
		}
	};

	// Attach document-level pointer listeners while resizing or dragging
	useEffect(() => {
		if (!resizingClip && !draggingClip) return;

		let raf = 0;
		let lastX = 0;
		const schedule = (cb: () => void) => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				cb();
			});
		};

		const onMove = (e: MouseEvent) => {
			lastX = e.clientX;
			schedule(() => {
				if (resizingClip) {
					const deltaX = lastX - resizingClip.startX;
					const deltaTime = deltaX / pixelsPerMs;
					if (resizingClip.type === "start") {
						// Left trim: move trimStart forward, and shift clip.startTime by same delta
						const newTrimStart = Math.max(
							0,
							Math.min(
								resizingClip.startTrimStart + deltaTime,
								resizingClip.startTrimEnd - 50,
							),
						);
						const trimDelta = newTrimStart - resizingClip.startTrimStart;
						const newClipStartTime = Math.max(
							0,
							resizingClip.startClipStartTime + trimDelta,
						);
						updateClip(resizingClip.trackId, resizingClip.clipId, {
							trimStart: newTrimStart,
							startTime: newClipStartTime,
						});
					} else {
						// Right trim: adjust trimEnd only, clamp to source duration
						const track = tracks.find((t) => t.id === resizingClip.trackId);
						const clip = track?.clips?.find(
							(c) => c.id === resizingClip.clipId,
						);
						const maxTrimEnd =
							clip?.sourceDurationMs ?? Number.MAX_SAFE_INTEGER;
						const newTrimEnd = Math.max(
							resizingClip.startTrimStart + 50,
							Math.min(resizingClip.startTrimEnd + deltaTime, maxTrimEnd),
						);
						updateClip(resizingClip.trackId, resizingClip.clipId, {
							trimEnd: newTrimEnd,
						});
					}
				}

				if (draggingClip) {
					const deltaX = lastX - draggingClip.startX;
					const deltaTime = deltaX / pixelsPerMs;
					const newStartTime = Math.max(0, draggingClip.startTime + deltaTime);
					updateClip(draggingClip.trackId, draggingClip.clipId, {
						startTime: newStartTime,
					});
				}
			});
		};

		const onUp = () => {
			setResizingClip(null);
			setDraggingClip(null);
			if (raf) cancelAnimationFrame(raf);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			if (raf) cancelAnimationFrame(raf);
		};
	}, [resizingClip, draggingClip, pixelsPerMs, updateClip]);

	return (
		<div ref={containerRef} className="relative w-full h-full">
			{tracks.map((track, index) => {
				// Track row layout
				const trackHeight = Math.round(DAW_HEIGHTS.TRACK_ROW * trackHeightZoom);
				const trackY = index * trackHeight;

				// Fallback legacy clip if no clips array yet
				const clips =
					track.clips && track.clips.length > 0
						? track.clips
						: [
								{
									id: track.id,
									name: track.name,
									opfsFileId: track.opfsFileId!,
									audioFileName: track.audioFileName,
									audioFileType: track.audioFileType,
									startTime: track.startTime,
									trimStart: track.trimStart,
									trimEnd: track.trimEnd,
									color: track.color,
								},
							];

				return (
					<div
						key={track.id}
						className={`absolute border-b border-border/50 transition-colors ${
							selectedTrackId === track.id ? "bg-muted/30" : ""
						}`}
						style={{
							top: trackY,
							height: trackHeight,
							left: 0,
							right: 0,
							padding: "12px",
						}}
					>
						{/* Track Drop Zone */}
						<button
							type="button"
							className={`absolute inset-0 w-full h-full border-none p-0 cursor-default transition-colors ${
								dragOverTrackId === track.id
									? "bg-primary/10 border-2 border-primary border-dashed"
									: "bg-transparent"
							}`}
							onDrop={(e) => handleTrackDrop(track.id, e)}
							onDragOver={(e) => e.preventDefault()}
							onDragEnter={() => setDragOverTrackId(track.id)}
							onDragLeave={(e) => {
								const rect = e.currentTarget.getBoundingClientRect();
								const x = e.clientX;
								const y = e.clientY;
								if (
									x < rect.left ||
									x > rect.right ||
									y < rect.top ||
									y > rect.bottom
								) {
									setDragOverTrackId(null);
								}
							}}
							onClick={() => setSelectedTrackId(track.id)}
							style={{ padding: "12px" }}
							aria-label={`Track ${track.name} drop zone`}
						>
							{/* Render clips */}
							{clips.map((clip) => {
								const clipX = clip.startTime * pixelsPerMs;
								const clipWidth = Math.max(
									(clip.trimEnd - clip.trimStart) * pixelsPerMs,
									20,
								);
								const isSelected =
									selectedTrackId === track.id && selectedClipId === clip.id;
								return (
									<div
										key={clip.id}
										className={`absolute top-0 bottom-0 rounded-md border-2 transition-all ${
											isSelected
												? "border-primary bg-primary/20"
												: "border-border bg-muted/50 hover:bg-muted/70"
										} ${track.muted ? "opacity-50" : ""}`}
										style={{
											left: clipX,
											width: clipWidth,
											backgroundColor: `${clip.color ?? track.color}20`,
											borderColor: clip.color ?? track.color,
										}}
										role="button"
										tabIndex={0}
										aria-label={`Select audio clip: ${clip.name}`}
										onMouseDown={(e) => {
											// Drag body if click is not near edges
											const rect = (
												e.currentTarget as HTMLDivElement
											).getBoundingClientRect();
											const localX = e.clientX - rect.left;
											const nearLeft = localX < 8;
											const nearRight = localX > rect.width - 8;
											setSelectedTrackId(track.id);
											setSelectedClipId(clip.id);
											if (!nearLeft && !nearRight) {
												setDraggingClip({
													trackId: track.id,
													clipId: clip.id,
													startX: e.clientX,
													startTime: clip.startTime,
												});
											}
										}}
									>
										{/* Left resize handle */}
										<div
											className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-primary/50 opacity-0 hover:opacity-100"
											onMouseDown={(e) => {
												e.stopPropagation();
												setSelectedTrackId(track.id);
												setSelectedClipId(clip.id);
												setResizingClip({
													trackId: track.id,
													clipId: clip.id,
													type: "start",
													startX: e.clientX,
													startTrimStart: clip.trimStart,
													startTrimEnd: clip.trimEnd,
													startClipStartTime: clip.startTime,
												});
											}}
											role="button"
											tabIndex={0}
											aria-label="Resize clip start"
										/>
										{/* Right resize handle */}
										<div
											className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-primary/50 opacity-0 hover:opacity-100"
											onMouseDown={(e) => {
												e.stopPropagation();
												setSelectedTrackId(track.id);
												setSelectedClipId(clip.id);
												setResizingClip({
													trackId: track.id,
													clipId: clip.id,
													type: "end",
													startX: e.clientX,
													startTrimStart: clip.trimStart,
													startTrimEnd: clip.trimEnd,
													startClipStartTime: clip.startTime,
												});
											}}
											role="button"
											tabIndex={0}
											aria-label="Resize clip end"
										/>

										{/* Clip label */}
										<div className="absolute inset-2 flex flex-col justify-center pointer-events-none">
											<div className="text-xs font-medium truncate text-left">
												{clip.name}
											</div>
											<div className="text-xs text-muted-foreground text-left">
												{formatDuration((clip.trimEnd - clip.trimStart) / 1000)}
											</div>
										</div>
									</div>
								);
							})}

							{/* Drop Zone Indicator - Only show when no audio */}
							{(!track.clips || track.clips.length === 0) &&
								track.duration === 0 && (
									<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
										Drop audio file here
									</div>
								)}
						</button>
					</div>
				);
			})}

			{/* Project end marker */}
			<div
				className="absolute top-0 bottom-0 w-px bg-yellow-500/70 z-40"
				style={{ left: projectEndPosition }}
				title="Project End"
			/>

			{/* Buffer/dead space overlay */}
			<div
				className="absolute top-0 bottom-0 bg-muted/10 pointer-events-none z-30"
				style={{ left: projectEndPosition, right: 0 }}
			/>

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
