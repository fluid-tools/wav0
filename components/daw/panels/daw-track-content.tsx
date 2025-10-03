"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClipContextMenu } from "@/components/daw/context-menus/clip-context-menu";
import { ClipFadeHandles } from "@/components/daw/controls/clip-fade-handles";
import { AutomationTransferDialog } from "@/components/daw/dialogs/automation-transfer-dialog";
import { AutomationLane } from "@/components/daw/panels/automation-lane";
import { playbackEngine } from "@/lib/audio/playback-engine";
import { DAW_HEIGHTS } from "@/lib/constants/daw-design";
import type { Clip } from "@/lib/state/daw-store";
import {
	activeToolAtom,
	loadAudioFileAtom,
	playbackAtom,
	projectEndPositionAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	timelineAtom,
	timelinePxPerMsAtom,
	totalDurationAtom,
	trackHeightZoomAtom,
	tracksAtom,
	updateClipAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";
import { cn } from "@/lib/utils";
import {
	countAutomationPointsInRange,
	removeAutomationPointsInRange,
	transferAutomationPoints,
} from "@/lib/utils/automation-utils";

export function DAWTrackContent() {
	const [tracks, setTracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [selectedClipId, setSelectedClipId] = useAtom(selectedClipIdAtom);
	const [_activeTool] = useAtom(activeToolAtom);
	const [, _updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);
	const [, loadAudioFile] = useAtom(loadAudioFileAtom);
	const [playback] = useAtom(playbackAtom);
	const [timeline] = useAtom(timelineAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [_totalDuration] = useAtom(totalDurationAtom);
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
		startY: number;
		startTime: number;
		originalTrackIndex: number;
		sourceTrackId: string;
	} | null>(null);

	const [loopDragging, setLoopDragging] = useState<{
		trackId: string;
		clipId: string;
		startX: number;
		startLoopEnd: number | undefined;
	} | null>(null);

	// Automation transfer dialog state
	const [automationTransferDialog, setAutomationTransferDialog] = useState<{
		open: boolean;
		clipId: string;
		clipName: string;
		sourceTrack: { id: string; name: string };
		targetTrack: { id: string; name: string };
		automationPointCount: number;
		newStartTime: number;
	} | null>(null);

	const containerRef = useRef<HTMLDivElement>(null);
	const scrollRef = useRef<{ left: number; width: number }>({
		left: 0,
		width: 0,
	});
	const RAF = useRef(0);
	const autoScrollActive = useRef(false);
	const [_gridCount, setGridCount] = useState(0);

	useEffect(() => {
		const update = () => {
			const width = containerRef.current?.getBoundingClientRect().width ?? 0;
			const gridSpacing = 100;
			setGridCount(Math.max(0, Math.ceil(width / gridSpacing)));
			const scrollable = containerRef.current?.parentElement;
			if (scrollable) {
				scrollRef.current = {
					left: scrollable.scrollLeft,
					width: scrollable.clientWidth,
				};
			}
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

	const pixelsPerMs = pxPerMs;

	const ensureAutoScroll = useCallback(() => {
		if (RAF.current) return;
		autoScrollActive.current = true;
		const tick = () => {
			RAF.current = 0;
			const scrollable = containerRef.current?.closest(
				'[data-daw-grid-scroll="true"]',
			) as HTMLDivElement | null;
			const active = draggingClip || resizingClip || loopDragging;
			if (!scrollable || !active) {
				autoScrollActive.current = false;
				return;
			}
			const width = scrollable.clientWidth;
			if (width <= 0) {
				RAF.current = requestAnimationFrame(tick);
				return;
			}
			const threshold = Math.min(96, width * 0.15);
			let delta = 0;
			const pointer = lastPointer.current;
			if (pointer) {
				const { clientX } = pointer;
				const rect = scrollable.getBoundingClientRect();
				const offsetX = clientX - rect.left;
				if (offsetX > width - threshold) {
					delta = Math.min(60, offsetX - (width - threshold));
				} else if (offsetX < threshold) {
					delta = -Math.min(60, threshold - offsetX);
				}
			}
			if (delta !== 0) {
				const base = scrollable.scrollLeft + delta * 1.35;
				const maxScroll = scrollable.scrollWidth - scrollable.clientWidth;
				const next = Math.max(0, Math.min(base, maxScroll));
				scrollable.scrollLeft = next;
				scrollRef.current.left = next;
				window.dispatchEvent(
					new CustomEvent("wav0:grid-scroll-request", {
						detail: { left: scrollable.scrollLeft, top: scrollable.scrollTop },
					}),
				);
			}
			RAF.current = requestAnimationFrame(tick);
		};
		RAF.current = requestAnimationFrame(tick);
	}, [draggingClip, loopDragging, resizingClip]);

	const lastPointer = useRef<{ clientX: number } | null>(null);

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

	const interactionActive = Boolean(
		resizingClip || draggingClip || loopDragging,
	);

	useEffect(() => {
		window.dispatchEvent(
			new CustomEvent("wav0:grid-pan-lock", { detail: interactionActive }),
		);
		if (interactionActive) ensureAutoScroll();
		return () => {
			window.dispatchEvent(
				new CustomEvent("wav0:grid-pan-lock", { detail: false }),
			);
			if (RAF.current) {
				cancelAnimationFrame(RAF.current);
				RAF.current = 0;
			}
			autoScrollActive.current = false;
			lastPointer.current = null;
		};
	}, [interactionActive, ensureAutoScroll]);

	// Attach document-level pointer listeners while resizing, dragging, or loop-dragging
	useEffect(() => {
		if (!interactionActive) return;

		let raf = 0;
		let lastX = 0;
		let lastY = 0;
		const schedule = (cb: () => void) => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				cb();
			});
		};

		const onMove = (e: MouseEvent) => {
			lastPointer.current = { clientX: e.clientX };
			lastX = e.clientX;
			lastY = e.clientY;
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
					// Horizontal movement (time)
					const deltaX = lastX - draggingClip.startX;
					const deltaTime = deltaX / pixelsPerMs;
					const newStartTime = Math.max(0, draggingClip.startTime + deltaTime);

					// Vertical movement (track switching)
					const deltaY = lastY - draggingClip.startY;
					const trackHeight = Math.round(
						DAW_HEIGHTS.TRACK_ROW * trackHeightZoom,
					);
					const trackIndexOffset = Math.round(deltaY / trackHeight);
					const newTrackIndex = Math.max(
						0,
						Math.min(
							tracks.length - 1,
							draggingClip.originalTrackIndex + trackIndexOffset,
						),
					);

					// Check if we need to move to a different track
					if (newTrackIndex !== draggingClip.originalTrackIndex) {
						const newTrack = tracks[newTrackIndex];
						const oldTrack = tracks.find((t) => t.id === draggingClip.trackId);

						if (newTrack && oldTrack && newTrack.id !== oldTrack.id) {
							// Find the clip
							const clip = oldTrack.clips?.find(
								(c) => c.id === draggingClip.clipId,
							);
							if (clip) {
								// Check for automation in clip's time range
								const clipEndTime =
									clip.startTime + (clip.trimEnd - clip.trimStart);
								const automationCount = countAutomationPointsInRange(
									oldTrack,
									clip.startTime,
									clipEndTime,
								);

								// Show dialog to confirm automation transfer
								setAutomationTransferDialog({
									open: true,
									clipId: clip.id,
									clipName: clip.name || "Untitled",
									sourceTrack: { id: oldTrack.id, name: oldTrack.name },
									targetTrack: { id: newTrack.id, name: newTrack.name },
									automationPointCount: automationCount,
									newStartTime,
								});

								// Pause further dragging until dialog is resolved
								setDraggingClip(null);
								return;
							}
						}
					}

					// Normal horizontal-only update
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
						if (timeline.snapToGrid && timeline.gridSize > 0) {
							newLoopEnd =
								Math.round(newLoopEnd / timeline.gridSize) * timeline.gridSize;
						}
						updateClip(loopDragging.trackId, loopDragging.clipId, {
							loopEnd: newLoopEnd,
						});
					}
				}
			});
		};

		const onUp = () => {
			lastPointer.current = null;
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
		interactionActive,
		resizingClip,
		draggingClip,
		loopDragging,
		pixelsPerMs,
		updateClip,
		tracks,
		timeline.snapToGrid,
		timeline.gridSize,
		trackHeightZoom,
	]);

	// Handle automation transfer dialog confirmation
	const handleAutomationTransfer = useCallback(
		(transferAutomation: boolean) => {
			if (!automationTransferDialog) return;

			const { clipId, sourceTrack, targetTrack, newStartTime } =
				automationTransferDialog;

			// Find tracks and clip
			const oldTrack = tracks.find((t) => t.id === sourceTrack.id);
			const newTrack = tracks.find((t) => t.id === targetTrack.id);
			const clip = oldTrack?.clips?.find((c) => c.id === clipId);

			if (!oldTrack || !newTrack || !clip) {
				setAutomationTransferDialog(null);
				return;
			}

			// Stop playback on old track if playing
			if (playback.isPlaying) {
				playbackEngine.stopClip(oldTrack.id, clipId);
			}

			const clipEndTime = clip.startTime + (clip.trimEnd - clip.trimStart);

			// Prepare updated tracks
			let updatedOldTrack = oldTrack;
			let updatedNewTrack = newTrack;

			if (transferAutomation) {
				// Transfer automation points to new track
				const pointsToTransfer = transferAutomationPoints(
					oldTrack,
					newTrack,
					clip.startTime,
					clipEndTime,
					newStartTime,
				);

				// Remove automation from old track
				updatedOldTrack = removeAutomationPointsInRange(
					oldTrack,
					clip.startTime,
					clipEndTime,
				);

				// Add automation to new track
				const newEnvelope = updatedNewTrack.volumeEnvelope || {
					enabled: true,
					points: [],
				};
				updatedNewTrack = {
					...updatedNewTrack,
					volumeEnvelope: {
						...newEnvelope,
						points: [...(newEnvelope.points || []), ...pointsToTransfer].sort(
							(a, b) => a.time - b.time,
						),
					},
				};
			}

			// Move clip with updated automation
			const updatedClip = { ...clip, startTime: newStartTime };

			setTracks((prev) =>
				prev.map((t) => {
					if (t.id === oldTrack.id) {
						return {
							...updatedOldTrack,
							clips:
								updatedOldTrack.clips?.filter((c) => c.id !== clipId) ?? [],
						};
					}
					if (t.id === newTrack.id) {
						return {
							...updatedNewTrack,
							clips: [...(updatedNewTrack.clips ?? []), updatedClip],
						};
					}
					return t;
				}),
			);

			setSelectedTrackId(newTrack.id);
			setAutomationTransferDialog(null);
		},
		[
			automationTransferDialog,
			tracks,
			playback.isPlaying,
			setTracks,
			setSelectedTrackId,
		],
	);

	return (
		<>
			<div ref={containerRef} className="relative w-full h-full" data-daw-grid>
				{tracks.map((track, index) => {
					// Track row layout
					const trackHeight = Math.round(
						DAW_HEIGHTS.TRACK_ROW * trackHeightZoom,
					);
					const trackY = index * trackHeight;

					// Fallback legacy clip only when the track has no multi-clip data defined
					const hasClipArray = Array.isArray(track.clips);
					const clips: Clip[] = hasClipArray
						? ((track.clips as Clip[]) ?? [])
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
							className={cn(
								"absolute border-b border-border/50 transition-colors",
								selectedTrackId === track.id ? "bg-muted/30 z-40" : "z-10",
							)}
							style={{
								top: trackY,
								height: trackHeight,
								left: 0,
								right: 0,
								padding: "12px",
							}}
						>
							{/* Track Drop Zone */}
							{/* biome-ignore lint/a11y/useSemanticElements: drop zone must remain a focusable div to host drag events without nesting buttons */}
							<div
								tabIndex={0}
								role="button"
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
										<ClipContextMenu
											key={clip.id}
											trackId={track.id}
											clipId={clip.id}
											clipName={clip.name}
										>
											<div
												key={clip.id}
												data-clip-id={clip.id}
												data-selected={isSelected ? "true" : "false"}
												className={`group absolute top-0 bottom-0 rounded-md border-2 transition-all ${
													isSelected
														? "border-primary bg-primary/10 ring-2 ring-primary"
														: "border-border bg-muted/50 hover:bg-muted/70"
												} ${track.muted ? "opacity-50" : ""}`}
												style={{
													left: clipX,
													width: clipWidth,
													...(isSelected
														? { backgroundColor: "hsl(var(--primary) / 0.18)" }
														: {
																backgroundColor: `${clip.color ?? track.color}20`,
																borderColor: clip.color ?? track.color,
															}),
												}}
											>
												{/* Full-body interactive area with context menu */}
												{/* biome-ignore lint/a11y/useSemanticElements: clip overlay must stay a div to avoid nested buttons while preserving keyboard access */}
												<div
													role="button"
													tabIndex={0}
													className="absolute inset-0 rounded-md bg-transparent cursor-default"
													aria-label={`Select audio clip: ${clip.name}`}
													onMouseDown={(e) => {
														const rect =
															e.currentTarget.getBoundingClientRect();
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
																startY: e.clientY,
																startTime: clip.startTime,
																originalTrackIndex: index,
																sourceTrackId: track.id,
															});
														}
													}}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															setSelectedTrackId(track.id);
															setSelectedClipId(clip.id);
														}
													}}
													onFocus={() => {
														setSelectedTrackId(track.id);
														setSelectedClipId(clip.id);
													}}
													onClick={(e) => {
														e.preventDefault();
														setSelectedTrackId(track.id);
														setSelectedClipId(clip.id);
													}}
												>
													<span className="sr-only">{`Select audio clip: ${clip.name}`}</span>
												</div>

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
															startY: e.clientY,
															startTime: clip.startTime,
															originalTrackIndex: index,
															sourceTrackId: track.id,
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

												{/* Clip label (Logic-style: top bar with name/duration) */}
												<div className="absolute left-2 right-2 top-1 flex items-center justify-between gap-2 pointer-events-none z-10">
													<div className="text-[11px] font-medium truncate">
														{clip.name}
													</div>
													<div className="text-[11px] text-muted-foreground tabular-nums">
														{formatDuration(clip.trimEnd - clip.trimStart, {
															pxPerMs: pixelsPerMs,
														})}
													</div>
												</div>

												{/* Fade Handles */}
												<ClipFadeHandles
													clip={clip}
													clipWidth={clipWidth}
													pixelsPerMs={pixelsPerMs}
													isSelected={isSelected}
													onFadeChange={(clipId, fade, value) => {
														updateClip(track.id, clipId, { [fade]: value });
													}}
												/>

												{/* Reserved center area for waveform */}
												<div className="absolute inset-x-2 top-5 bottom-2 rounded-sm bg-background/20 pointer-events-none" />
											</div>
										</ClipContextMenu>
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
									if (
										!isSelected ||
										!isLoop ||
										!loopEnd ||
										loopEnd <= oneShotEnd
									)
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

								{/* Automation Lane Overlay */}
								<AutomationLane
									track={track}
									trackHeight={trackHeight}
									trackWidth={
										containerRef.current?.getBoundingClientRect().width ?? 2000
									}
								/>
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

			{/* Automation Transfer Dialog */}
			{automationTransferDialog && (
				<AutomationTransferDialog
					open={automationTransferDialog.open}
					onOpenChange={(open) => {
						if (!open) setAutomationTransferDialog(null);
					}}
					onConfirm={handleAutomationTransfer}
					clipName={automationTransferDialog.clipName}
					sourceTrackName={automationTransferDialog.sourceTrack.name}
					targetTrackName={automationTransferDialog.targetTrack.name}
					automationPointCount={automationTransferDialog.automationPointCount}
				/>
			)}
		</>
	);
}
