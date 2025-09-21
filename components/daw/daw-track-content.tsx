"use client";

import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import { DAW_HEIGHTS } from "@/lib/constants/daw-design";
import type { Clip } from "@/lib/state/daw-store";
import {
	activeToolAtom,
	loadAudioFileAtom,
	projectEndPositionAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	timelineAtom,
	totalDurationAtom,
	trackHeightZoomAtom,
	tracksAtom,
	updateClipAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWTrackContent() {
	const [tracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [selectedClipId, setSelectedClipId] = useAtom(selectedClipIdAtom);
	const [_activeTool] = useAtom(activeToolAtom);
	const [, _updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);
	const [, loadAudioFile] = useAtom(loadAudioFileAtom);
	const [timeline] = useAtom(timelineAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [totalDuration] = useAtom(totalDurationAtom);

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

	// Loop-end dragging state
	const [loopDragging, setLoopDragging] = useState<{
		trackId: string;
		clipId: string;
		startX: number;
		startLoopEnd: number | undefined;
	} | null>(null);

	const containerRef = useRef<HTMLDivElement>(null);
	const [_gridCount, setGridCount] = useState(0);

	useEffect(() => {
		const update = () => {
			const width = containerRef.current?.getBoundingClientRect().width ?? 0;
			const gridSpacing = 100;
			setGridCount(Math.max(0, Math.ceil(width / gridSpacing)));
		};
		update();
		const ro =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
		if (ro && containerRef.current) ro.observe(containerRef.current);
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("resize", update);
			if (ro && containerRef.current) ro.unobserve(containerRef.current);
		};
	}, []);
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

	// Attach document-level pointer listeners while resizing, dragging, or loop-dragging
	useEffect(() => {
		if (!resizingClip && !draggingClip && !loopDragging) return;

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

				if (loopDragging) {
					const deltaX = lastX - loopDragging.startX;
					const deltaTime = deltaX / pixelsPerMs;
					const track = tracks.find((t) => t.id === loopDragging.trackId);
					const clip = track?.clips?.find((c) => c.id === loopDragging.clipId);
					if (clip) {
						const clipDur = Math.max(0, clip.trimEnd - clip.trimStart);
						const oneShotEnd = clip.startTime + clipDur;
						const baseLoopEnd =
							loopDragging.startLoopEnd === undefined
								? oneShotEnd
								: loopDragging.startLoopEnd;
						let newLoopEnd = Math.max(oneShotEnd, baseLoopEnd + deltaTime);
						// Snap to grid if enabled for cleaner control
						if (timeline.snapToGrid && timeline.gridSize > 0) {
							newLoopEnd =
								Math.round(newLoopEnd / timeline.gridSize) * timeline.gridSize;
						}
						newLoopEnd = Math.min(newLoopEnd, totalDuration);
						updateClip(loopDragging.trackId, loopDragging.clipId, {
							loopEnd: newLoopEnd,
						});
					}
				}
			});
		};

		const onUp = () => {
			setResizingClip(null);
			setDraggingClip(null);
			setLoopDragging(null);
			if (raf) cancelAnimationFrame(raf);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			if (raf) cancelAnimationFrame(raf);
		};
	}, [
		resizingClip,
		draggingClip,
		loopDragging,
		pixelsPerMs,
		updateClip,
		tracks,
		totalDuration,
		timeline.snapToGrid,
		timeline.gridSize,
	]);

	return (
		<div ref={containerRef} className="relative w-full h-full">
			{tracks.map((track, index) => {
				// Track row layout
				const trackHeight = Math.round(DAW_HEIGHTS.TRACK_ROW * trackHeightZoom);
				const trackY = index * trackHeight;

				// Fallback legacy clip if no clips array yet
				const clips: Clip[] =
					track.clips && track.clips.length > 0
						? (track.clips as Clip[])
						: track.opfsFileId
							? [
									{
										id: track.id,
										name: track.name,
										opfsFileId: track.opfsFileId,
										audioFileName: track.audioFileName,
										audioFileType: track.audioFileType,
										startTime: track.startTime,
										trimStart: track.trimStart,
										trimEnd: track.trimEnd,
										sourceDurationMs: Math.max(
											0,
											track.trimEnd - track.trimStart,
										),
										color: track.color,
									} as Clip,
								]
							: [];

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
						<div
							role="button"
							tabIndex={0}
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
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									setSelectedTrackId(track.id);
								}
							}}
							style={{ padding: "12px" }}
							role="group"
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
										className={`group absolute top-0 bottom-0 rounded-md border-2 transition-all ${
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
									>
										{/* Full-body interactive area */}
										<button
											type="button"
											className="absolute inset-0 rounded-md bg-transparent cursor-default"
											aria-label={`Select audio clip: ${clip.name}`}
											onMouseDown={(e) => {
												// Drag body if click is not near edges
												const rect = (
													e.currentTarget as HTMLButtonElement
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
										/>

										{/* Visible grab handle on hover */}
										<button
											type="button"
											className="absolute top-1/2 -translate-y-1/2 left-2 h-8 w-2 rounded-sm opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
											style={{
												background:
													"repeating-linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.35) 2px, transparent 2px, transparent 4px)",
											}}
											onMouseDown={(e) => {
												e.stopPropagation();
												setSelectedTrackId(track.id);
												setSelectedClipId(clip.id);
												setDraggingClip({
													trackId: track.id,
													clipId: clip.id,
													startX: e.clientX,
													startTime: clip.startTime,
												});
											}}
											aria-label="Drag clip"
										/>

										{/* Left resize handle */}
										<button
											type="button"
											className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-primary/20 hover:bg-primary/40"
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
											aria-label="Resize clip start"
										/>
										{/* Right resize handle */}
										<button
											type="button"
											className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-primary/20 hover:bg-primary/40"
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

							{/* Loop ghosts overlay (non-interactive) */}
							{clips.map((clip) => {
								const loop = clip.loop;
								const loopEnd = clip.loopEnd;
								const clipDur = Math.max(0, clip.trimEnd - clip.trimStart);
								if (!loop || clipDur <= 0) return null;
								const oneShotEnd = clip.startTime + clipDur;
								if (!loopEnd || loopEnd <= oneShotEnd) return null;

								const tiles: React.ReactNode[] = [];
								const separators: React.ReactNode[] = [];
								for (let t = oneShotEnd; t < loopEnd; t += clipDur) {
									const end = Math.min(t + clipDur, loopEnd);
									const left = t * pixelsPerMs;
									const width = Math.max((end - t) * pixelsPerMs, 8);
									tiles.push(
										<div
											key={`ghost-${clip.id}-${t}`}
											className="absolute top-0 bottom-0 rounded-md pointer-events-none"
											style={{
												left,
												width,
												backgroundColor: `${clip.color ?? track.color}14`,
												border: `1px dashed ${clip.color ?? track.color}`,
												opacity: 0.5,
												zIndex: 1,
											}}
										/>,
									);
									separators.push(
										<div
											key={`sep-${clip.id}-${t}`}
											className="absolute top-0 bottom-0 w-px pointer-events-none"
											style={{
												left,
												backgroundColor: clip.color ?? track.color,
												opacity: 0.5,
												zIndex: 2,
											}}
										/>,
									);
								}
								return (
									<div
										key={`ghost-wrap-${clip.id}`}
										className="absolute inset-0 pointer-events-none z-0"
									>
										{tiles}
										{separators}
									</div>
								);
							})}

							{/* Loop-end marker + handle (interactive only at loopEnd) */}
							{clips.map((clip) => {
								const isSelected =
									selectedTrackId === track.id && selectedClipId === clip.id;
								const isLoop = clip.loop;
								const clipDur = Math.max(0, clip.trimEnd - clip.trimStart);
								const oneShotEnd = clip.startTime + clipDur;
								const loopEnd = clip.loopEnd;
								if (!isSelected || !isLoop || !loopEnd || loopEnd <= oneShotEnd)
									return null;
								const xPx = loopEnd * pixelsPerMs;
								return (
									<div
										key={`loop-end-${clip.id}`}
										className="absolute inset-0 z-20 pointer-events-none"
									>
										<div
											className="absolute top-0 bottom-0 w-px bg-primary/70 pointer-events-none"
											style={{ left: xPx }}
										/>
										<button
											type="button"
											className="absolute top-1/2 -translate-y-1/2 w-3 h-6 rounded-sm bg-primary shadow cursor-ew-resize pointer-events-auto"
											style={{ left: xPx - 6 }}
											onMouseDown={(e) => {
												e.stopPropagation();
												setLoopDragging({
													trackId: track.id,
													clipId: clip.id,
													startX: e.clientX,
													startLoopEnd: clip.loopEnd,
												});
											}}
											aria-label="Adjust loop end"
										/>
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
						</div>
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
				{(() => {
					const gridSpacing = 100;
					const width =
						containerRef.current?.getBoundingClientRect().width ?? 0;
					const count = Math.ceil(width / gridSpacing);
					return Array.from({ length: count }).map((_, i) => (
						<div
							key={`grid-line-${i * gridSpacing}`}
							className="absolute top-0 bottom-0 w-px bg-border/20"
							style={{ left: i * gridSpacing }}
						/>
					));
				})()}
			</div>
		</div>
	);
}
