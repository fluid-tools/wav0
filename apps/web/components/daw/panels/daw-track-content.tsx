"use client";

import {
	activeToolAtom,
	clipMoveHistoryAtom,
	isPlayingAtom,
	loadAudioFileAtom,
	projectEndPositionAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	serviceRegistry,
	timelineAtom,
	timelinePxPerMsAtom,
	timelineWidthAtom,
	totalDurationAtom,
	trackHeightZoomAtom,
	tracksAtom,
	updateClipAtom,
	updateTrackAtom,
	useTimebase,
	useTrackInteractions,
} from "@wav0/daw-react";
import type {
	Clip,
	Track,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
} from "@wav0/daw-sdk";
import { time } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { memo, useEffect, useRef, useState } from "react";
import { ClipContextMenu } from "@/components/daw/context-menus/clip-context-menu";
import { ClipFadeHandles } from "@/components/daw/controls/clip-fade-handles";
import { AutomationLane } from "@/components/daw/panels/automation-lane";
import { DAW_HEIGHTS } from "@/lib/constants/daw-design";
import { cn } from "@/lib/utils";
import {
	computeAutomationTransfer,
	mergeAutomationPoints,
} from "@/lib/utils/automation-helpers";

// ===== Memoized Clip Component =====
type MemoizedClipProps = {
	clip: Clip;
	track: Track;
	trackIndex: number;
	pixelsPerMs: number;
	isSelected: boolean;
	onSelect: (trackId: string, clipId: string) => void;
	onStartDrag: (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startY: number;
		startTime: number;
		originalTrackIndex: number;
		sourceTrackId: string;
		offsetX: number;
		offsetY: number;
	}) => void;
	onStartResize: (params: {
		trackId: string;
		clipId: string;
		type: "start" | "end";
		startX: number;
		startTrimStart: number;
		startTrimEnd: number;
		startClipStartTime: number;
	}) => void;
	onFadeChange: (clipId: string, fade: string, value: number) => void;
};

const MemoizedClip = memo(function MemoizedClip({
	clip,
	track,
	trackIndex,
	pixelsPerMs,
	isSelected,
	onSelect,
	onStartDrag,
	onStartResize,
	onFadeChange,
}: MemoizedClipProps) {
	const clipX = clip.startTime * pixelsPerMs;
	const clipWidth = Math.max((clip.trimEnd - clip.trimStart) * pixelsPerMs, 20);

	return (
		<ClipContextMenu trackId={track.id} clipId={clip.id} clipName={clip.name}>
			<div
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
						const rect = e.currentTarget.getBoundingClientRect();
						const localX = e.clientX - rect.left;
						const nearLeft = localX < 8;
						const nearRight = localX > rect.width - 8;
						onSelect(track.id, clip.id);
						if (!nearLeft && !nearRight) {
							onStartDrag({
								trackId: track.id,
								clipId: clip.id,
								startX: e.clientX,
								startY: e.clientY,
								startTime: clip.startTime,
								originalTrackIndex: trackIndex,
								sourceTrackId: track.id,
								offsetX: e.clientX - rect.left,
								offsetY: e.clientY - rect.top,
							});
						}
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							onSelect(track.id, clip.id);
						}
					}}
					onFocus={() => onSelect(track.id, clip.id)}
					onClick={(e) => {
						e.preventDefault();
						onSelect(track.id, clip.id);
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
						const rect = e.currentTarget.parentElement?.getBoundingClientRect();
						onSelect(track.id, clip.id);
						if (rect) {
							onStartDrag({
								trackId: track.id,
								clipId: clip.id,
								startX: e.clientX,
								startY: e.clientY,
								startTime: clip.startTime,
								originalTrackIndex: trackIndex,
								sourceTrackId: track.id,
								offsetX: e.clientX - rect.left,
								offsetY: e.clientY - rect.top,
							});
						}
					}}
					aria-label="Drag clip"
				/>

				{/* Left resize handle */}
				<button
					type="button"
					className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-primary/20 hover:bg-primary/40"
					onMouseDown={(e) => {
						e.stopPropagation();
						onSelect(track.id, clip.id);
						onStartResize({
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
						onSelect(track.id, clip.id);
						onStartResize({
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
					<div className="text-[11px] font-medium truncate">{clip.name}</div>
					<div className="text-[11px] text-muted-foreground tabular-nums">
						{time.formatDuration(clip.trimEnd - clip.trimStart, {
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
					onFadeChange={onFadeChange}
				/>

				{/* Reserved center area for waveform */}
				<div className="absolute inset-x-2 top-5 bottom-2 rounded-sm bg-background/20 pointer-events-none" />
			</div>
		</ClipContextMenu>
	);
});

// ===== Memoized Track Row Component =====
type TrackRowProps = {
	track: Track;
	index: number;
	trackHeight: number;
	pixelsPerMs: number;
	timelineWidth: number;
	isSelected: boolean;
	selectedClipId: string | null;
	dragOverTrackId: string | null;
	onTrackSelect: (trackId: string) => void;
	onClipSelect: (trackId: string, clipId: string) => void;
	onTrackDrop: (trackId: string, e: React.DragEvent) => void;
	onDragEnter: (trackId: string) => void;
	onDragLeave: (trackId: string, e: React.DragEvent) => void;
	onStartClipDrag: (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startY: number;
		startTime: number;
		originalTrackIndex: number;
		sourceTrackId: string;
		offsetX: number;
		offsetY: number;
	}) => void;
	onStartResize: (params: {
		trackId: string;
		clipId: string;
		type: "start" | "end";
		startX: number;
		startTrimStart: number;
		startTrimEnd: number;
		startClipStartTime: number;
	}) => void;
	onStartLoopDrag: (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startLoopEnd: number | undefined;
	}) => void;
	onFadeChange: (
		trackId: string,
		clipId: string,
		fade: string,
		value: number,
	) => void;
};

const TrackRow = memo(function TrackRow({
	track,
	index,
	trackHeight,
	pixelsPerMs,
	timelineWidth,
	isSelected,
	selectedClipId,
	dragOverTrackId,
	onTrackSelect,
	onClipSelect,
	onTrackDrop,
	onDragEnter,
	onDragLeave,
	onStartClipDrag,
	onStartResize,
	onStartLoopDrag,
	onFadeChange,
}: TrackRowProps) {
	const trackY = index * trackHeight;

	// Get clips for this track
	const clips: Clip[] = (() => {
		const hasClipArray = Array.isArray(track.clips);
		if (hasClipArray) {
			return (track.clips as Clip[]) ?? [];
		}
		if (track.opfsFileId) {
			return [
				{
					id: track.id,
					name: track.name,
					opfsFileId: track.opfsFileId,
					audioFileName: track.audioFileName,
					audioFileType: track.audioFileType,
					startTime: track.startTime,
					trimStart: track.trimStart,
					trimEnd: track.trimEnd,
					sourceDurationMs: Math.max(0, track.trimEnd - track.trimStart),
					color: track.color,
				} as Clip,
			];
		}
		return [];
	})();

	const handleSelect = (trackId: string, clipId: string) =>
		onClipSelect(trackId, clipId);

	const handleFadeChange = (clipId: string, fade: string, value: number) =>
		onFadeChange(track.id, clipId, fade, value);

	return (
		<div
			className={cn(
				"absolute border-b border-border/50 transition-colors",
				isSelected ? "bg-muted/30 z-40" : "z-10",
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
				onDrop={(e) => onTrackDrop(track.id, e)}
				onDragOver={(e) => e.preventDefault()}
				onDragEnter={() => onDragEnter(track.id)}
				onDragLeave={(e) => onDragLeave(track.id, e)}
				onClick={() => onTrackSelect(track.id)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onTrackSelect(track.id);
					}
				}}
				style={{ padding: "12px" }}
				aria-label={`Track ${track.name} drop zone`}
			>
				{/* Render clips */}
				{clips.map((clip) => (
					<MemoizedClip
						key={clip.id}
						clip={clip}
						track={track}
						trackIndex={index}
						pixelsPerMs={pixelsPerMs}
						isSelected={isSelected && selectedClipId === clip.id}
						onSelect={handleSelect}
						onStartDrag={onStartClipDrag}
						onStartResize={onStartResize}
						onFadeChange={handleFadeChange}
					/>
				))}

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
					const clipIsSelected = isSelected && selectedClipId === clip.id;
					const isLoop = clip.loop;
					const clipDur = Math.max(0, clip.trimEnd - clip.trimStart);
					const oneShotEnd = clip.startTime + clipDur;
					const loopEnd = clip.loopEnd;
					if (!clipIsSelected || !isLoop || !loopEnd || loopEnd <= oneShotEnd)
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
									onStartLoopDrag({
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
				{clips.length === 0 && track.duration === 0 && (
					<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
						Drop audio file here
					</div>
				)}

				{/* Automation Lane Overlay */}
				<AutomationLane
					track={track}
					trackHeight={trackHeight}
					trackWidth={timelineWidth}
				/>
			</div>
		</div>
	);
});

export function DAWTrackContent() {
	const [tracks, setTracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [selectedClipId, setSelectedClipId] = useAtom(selectedClipIdAtom);
	const [_activeTool] = useAtom(activeToolAtom);
	const [, _updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);
	const [, loadAudioFile] = useAtom(loadAudioFileAtom);
	// Use isPlayingAtom instead of playbackAtom to avoid re-renders on currentTime changes
	const [isPlaying] = useAtom(isPlayingAtom);
	const [timeline] = useAtom(timelineAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [totalDuration] = useAtom(totalDurationAtom);
	const { snap } = useTimebase();

	// Unified interaction state machine (replaces local useState)
	const {
		isActive: interactionActive,
		clipDrag: dragPreview,
		resize: resizingClip,
		loopDrag: loopDragging,
		startClipDrag,
		startResize,
		startLoopDrag,
		move: sendInteractionMove,
		commit: commitInteraction,
	} = useTrackInteractions();

	// Derived state for backwards compatibility
	const draggingClip = dragPreview
		? {
				trackId: dragPreview.originalTrackId,
				clipId: dragPreview.clipId,
				startX: dragPreview.startX,
				startY: dragPreview.startY,
				startTime: dragPreview.originalStartTime,
				originalTrackIndex: -1, // Computed during move
				sourceTrackId: dragPreview.originalTrackId,
				startScrollLeft: dragPreview.startScrollLeft,
			}
		: null;

	const [, setMoveHistory] = useAtom(clipMoveHistoryAtom);

	const containerRef = useRef<HTMLDivElement>(null);
	const scrollRef = useRef<{ left: number; width: number }>({
		left: 0,
		width: 0,
	});
	const RAF = useRef(0);
	const autoScrollActive = useRef(false);
	// Refs for RAF loop to read current drag state (avoids stale closure)
	const dragStateRef = useRef<{
		dragging: boolean;
		resizing: boolean;
		looping: boolean;
	}>({ dragging: false, resizing: false, looping: false });
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

		let resizeTimeout: NodeJS.Timeout;
		const debouncedUpdate = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(update, 100);
		};

		const ro =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
		if (ro && containerRef.current) ro.observe(containerRef.current);
		window.addEventListener("resize", debouncedUpdate);

		return () => {
			clearTimeout(resizeTimeout);
			window.removeEventListener("resize", debouncedUpdate);
			if (ro && containerRef.current) ro.unobserve(containerRef.current);
		};
	}, []);
	const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

	// Keep drag state ref in sync for RAF loop
	dragStateRef.current = {
		dragging: !!draggingClip,
		resizing: !!resizingClip,
		looping: !!loopDragging,
	};

	const pixelsPerMs = pxPerMs;

	const ensureAutoScroll = () => {
		if (RAF.current) return;
		autoScrollActive.current = true;
		const tick = () => {
			RAF.current = 0;
			const scrollable = containerRef.current?.closest(
				'[data-daw-grid-scroll="true"]',
			) as HTMLDivElement | null;
			// Read from ref to get current state (not stale closure)
			const { dragging, resizing, looping } = dragStateRef.current;
			const active = dragging || resizing || looping;
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
	};

	const lastPointer = useRef<{ clientX: number } | null>(null);

	const handleTrackDrop = async (trackId: string, e: React.DragEvent) => {
		e.preventDefault();
		setDragOverTrackId(null);

		const files = Array.from(e.dataTransfer.files).filter((file) =>
			file.type.startsWith("audio/"),
		);

		if (files.length === 0) return;

		const file = files[0];

		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const startTime = x / pixelsPerMs;

		try {
			await loadAudioFile(file, trackId, { startTimeMs: startTime });
		} catch (error) {
			console.error("Error loading audio file:", error);
		}
	};

	// interactionActive is now from useTrackInteractions hook

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
	}, [interactionActive]);

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
					// Compensate for scroll changes during drag (read directly from scrollable)
					const scrollable = containerRef.current?.closest(
						'[data-daw-grid-scroll="true"]',
					) as HTMLDivElement | null;
					const currentScrollLeft = scrollable?.scrollLeft ?? scrollRef.current.left;
					const scrollDelta = currentScrollLeft - draggingClip.startScrollLeft;
					const deltaX = (lastX - draggingClip.startX) + scrollDelta;
					const deltaTime = deltaX / pixelsPerMs;
					let previewStartTime = Math.max(
						0,
						draggingClip.startTime + deltaTime,
					);
					if (timeline.snapToGrid) {
						previewStartTime = snap(previewStartTime);
					}

					const trackHeight = Math.round(
						DAW_HEIGHTS.TRACK_ROW * trackHeightZoom,
					);
					const container = containerRef.current;
					let newTrackIndex = draggingClip.originalTrackIndex;
					if (container) {
						const rect = container.getBoundingClientRect();
						const relativeY = lastY - rect.top + container.scrollTop;
						const targetTrackIndex = Math.floor(relativeY / trackHeight);
						newTrackIndex = Math.max(
							0,
							Math.min(tracks.length - 1, targetTrackIndex),
						);
					}
					const previewTrackId =
						tracks[newTrackIndex]?.id ?? draggingClip.trackId;

					sendInteractionMove({
						previewTrackId,
						previewStartTime,
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
						if (timeline.snapToGrid) {
							newLoopEnd = snap(newLoopEnd);
						}
						updateClip(loopDragging.trackId, loopDragging.clipId, {
							loopEnd: newLoopEnd,
						});
					}
				}
			});
		};

		const onUp = async () => {
			// Cleanup via state machine - no try/finally needed
			const cleanup = () => {
				commitInteraction(); // Machine resets to idle, clearing all state
				lastPointer.current = null;
				if (raf) cancelAnimationFrame(raf);
			};

			// No try/catch needed - individual async ops have their own error handling
				if (dragPreview && draggingClip) {
					let computedUpdated: Track[] | null = null;
					let computedClip: Clip | null = null;
					let computedOriginalTrack: Track | null = null;
					let computedTargetTrack: Track | null = null;
					let computedAutomationData: {
						points: TrackEnvelopePoint[];
						segments: TrackEnvelopeSegment[];
						pointIdsToRemove: string[];
					} | null = null;

					setTracks((prev) => {
						const originalTrack = prev.find(
							(t) => t.id === dragPreview.originalTrackId,
						);
						const targetTrack = prev.find(
							(t) => t.id === dragPreview.previewTrackId,
						);
						const clip = originalTrack?.clips?.find(
							(c) => c.id === dragPreview.clipId,
						);

						if (!originalTrack || !targetTrack || !clip) {
							return prev;
						}

						computedClip = clip;
						computedOriginalTrack = originalTrack;
						computedTargetTrack = targetTrack;

						const isSameTrack =
							dragPreview.originalTrackId === dragPreview.previewTrackId;
						const moved =
							!isSameTrack ||
							dragPreview.originalStartTime !== dragPreview.previewStartTime;

						if (!moved) {
							return prev;
						}

						const clipDurationMs = clip.trimEnd - clip.trimStart;
						const clipEndTime = clip.startTime + clipDurationMs;

						if (isSameTrack) {
							return prev;
						}

						const hasAutomation =
							originalTrack.volumeEnvelope?.enabled ?? false;

						let automationData: {
							points: TrackEnvelopePoint[];
							segments: TrackEnvelopeSegment[];
							pointIdsToRemove: string[];
						} | null = null;

						if (hasAutomation && originalTrack.volumeEnvelope) {
							const projectEndMs =
								totalDuration && totalDuration > 0 ? totalDuration : 300000;
							const finalDropTime = Math.max(
								0,
								Math.min(
									projectEndMs,
									Math.round(dragPreview.previewStartTime),
								),
							);

							const transferResult = computeAutomationTransfer(
								originalTrack.volumeEnvelope,
								clip.id,
								clip.startTime,
								clipEndTime,
								finalDropTime,
								clip.id,
								projectEndMs,
								{ mode: "clip-attached", includeEndBoundary: true },
							);

							if (transferResult.pointsToAdd.length > 0) {
								automationData = {
									points: transferResult.pointsToAdd,
									segments: transferResult.segmentsToAdd,
									pointIdsToRemove: transferResult.pointIdsToRemove,
								};
								computedAutomationData = automationData;
							}
						}

						const updated = prev.map((t) => {
							if (t.id === originalTrack.id) {
								const updatedTrack = {
									...t,
									clips: t.clips?.filter((c) => c.id !== clip.id) ?? [],
								};
								if (automationData) {
									const currentEnv = updatedTrack.volumeEnvelope;
									if (currentEnv) {
										const remainingPointIds = new Set(
											automationData.pointIdsToRemove,
										);
										return {
											...updatedTrack,
											volumeEnvelope: {
												...currentEnv,
												points: currentEnv.points.filter(
													(p) => !remainingPointIds.has(p.id),
												),
												segments: (currentEnv.segments || []).filter(
													(s) =>
														!remainingPointIds.has(s.fromPointId) &&
														!remainingPointIds.has(s.toPointId),
												),
											},
										};
									}
								}
								return updatedTrack;
							}
							if (t.id === targetTrack.id) {
								const movedClip = {
									...clip,
									startTime: dragPreview.previewStartTime,
								};
								let updatedTrack: typeof t = {
									...t,
									clips: [...(t.clips ?? []), movedClip],
								};
								if (automationData) {
									const currentEnv = updatedTrack.volumeEnvelope || {
										enabled: true,
										points: [],
										segments: [],
									};
									updatedTrack = {
										...updatedTrack,
										volumeEnvelope: {
											...currentEnv,
											enabled: true,
											points: mergeAutomationPoints(
												currentEnv.points || [],
												automationData.points,
											),
											segments: [
												...(currentEnv.segments || []),
												...automationData.segments,
											],
										},
									};
								}
								return updatedTrack;
							}
							return t;
						});

						computedUpdated = updated;
						return updated;
					});

					if (
						computedUpdated &&
						computedClip &&
						computedOriginalTrack &&
						computedTargetTrack
					) {
						const clip = computedClip as Clip;
						const originalTrack = computedOriginalTrack as Track;
						const targetTrack = computedTargetTrack as Track;
						const updated = computedUpdated;

						if (isPlaying && serviceRegistry.playbackService) {
							try {
								await serviceRegistry.playbackService.synchronizeTracks(
									updated,
								);
							} catch (error) {
								console.error(
									"Failed to synchronize tracks after clip move",
									error,
								);
							}
						}

						setMoveHistory((prev) => [
							{
								clipId: clip.id,
								fromTrackId: originalTrack.id,
								toTrackId: targetTrack.id,
								fromStartTime: dragPreview.originalStartTime,
								toStartTime: dragPreview.previewStartTime,
								automationData: computedAutomationData,
								timestamp: Date.now(),
							},
							...prev.slice(0, 9),
						]);
					} else if (computedClip && computedOriginalTrack) {
						const clip = computedClip as Clip;
						const originalTrack = computedOriginalTrack as Track;
						const isSameTrack =
							dragPreview.originalTrackId === dragPreview.previewTrackId;
						const moved =
							!isSameTrack ||
							dragPreview.originalStartTime !== dragPreview.previewStartTime;

						if (moved && isSameTrack) {
							// updateClipAtom internally calls serviceRegistry.playbackService.synchronizeTracks()
							// which handles stopping the old position and rescheduling at the new position
							await updateClip(originalTrack.id, clip.id, {
								startTime: dragPreview.previewStartTime,
							});

							setMoveHistory((prev) => {
								const now = Date.now();
								const recent = prev[0];
								if (recent && now - recent.timestamp < 100) {
									return prev;
								}
								return [
									{
										clipId: clip.id,
										fromTrackId: originalTrack.id,
										toTrackId: originalTrack.id,
										fromStartTime: dragPreview.originalStartTime,
										toStartTime: dragPreview.previewStartTime,
										automationData: null,
										timestamp: now,
									},
									...prev.slice(0, 9),
								];
							});
						}
					}
				}
			cleanup();
		};

		const onCancel = onUp;

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		window.addEventListener("pointercancel", onCancel);
		window.addEventListener("blur", onCancel);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			window.removeEventListener("pointercancel", onCancel);
			window.removeEventListener("blur", onCancel);
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
		trackHeightZoom,
		totalDuration,
		isPlaying,
		setTracks,
		dragPreview,
		commitInteraction,
		sendInteractionMove,
		setMoveHistory,
		snap,
	]);

	// Handlers - compiler handles memoization
	const handleTrackSelect = (trackId: string) => setSelectedTrackId(trackId);

	const handleClipSelect = (trackId: string, clipId: string) => {
		setSelectedTrackId(trackId);
		setSelectedClipId(clipId);
	};

	const handleDragEnter = (trackId: string) => setDragOverTrackId(trackId);

	const handleDragLeave = (_trackId: string, e: React.DragEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;
		if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
			setDragOverTrackId(null);
		}
	};

	const handleStartClipDrag = (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startY: number;
		startTime: number;
		originalTrackIndex: number;
		sourceTrackId: string;
		offsetX: number;
		offsetY: number;
	}) => {
		const scrollable = containerRef.current?.closest(
			'[data-daw-grid-scroll="true"]',
		) as HTMLDivElement | null;
		const currentScrollLeft = scrollable?.scrollLeft ?? 0;
		startClipDrag({
			trackId: params.trackId,
			clipId: params.clipId,
			startX: params.startX,
			startY: params.startY,
			startTime: params.startTime,
			originalTrackIndex: params.originalTrackIndex,
			offsetX: params.offsetX,
			offsetY: params.offsetY,
			startScrollLeft: currentScrollLeft,
		});
	};

	const handleStartResize = (params: {
		trackId: string;
		clipId: string;
		type: "start" | "end";
		startX: number;
		startTrimStart: number;
		startTrimEnd: number;
		startClipStartTime: number;
	}) => {
		startResize({
			trackId: params.trackId,
			clipId: params.clipId,
			resizeType: params.type,
			startX: params.startX,
			startTrimStart: params.startTrimStart,
			startTrimEnd: params.startTrimEnd,
			startClipStartTime: params.startClipStartTime,
		});
	};

	const handleStartLoopDrag = (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startLoopEnd: number | undefined;
	}) => startLoopDrag(params);

	const handleFadeChange = (trackId: string, clipId: string, fade: string, value: number) =>
		updateClip(trackId, clipId, { [fade]: value });

	// Compute track height once
	const trackHeight = Math.round(DAW_HEIGHTS.TRACK_ROW * trackHeightZoom);

	return (
		<>
			<div
				ref={containerRef}
				className="relative w-full h-full"
				data-daw-grid
				data-dragging={draggingClip ? "true" : undefined}
			>
				{tracks.map((track, index) => (
					<TrackRow
						key={track.id}
						track={track}
						index={index}
						trackHeight={trackHeight}
						pixelsPerMs={pixelsPerMs}
						timelineWidth={timelineWidth}
						isSelected={selectedTrackId === track.id}
						selectedClipId={selectedClipId}
						dragOverTrackId={dragOverTrackId}
						onTrackSelect={handleTrackSelect}
						onClipSelect={handleClipSelect}
						onTrackDrop={handleTrackDrop}
						onDragEnter={handleDragEnter}
						onDragLeave={handleDragLeave}
						onStartClipDrag={handleStartClipDrag}
						onStartResize={handleStartResize}
						onStartLoopDrag={handleStartLoopDrag}
						onFadeChange={handleFadeChange}
					/>
				))}

				{/* Drag Preview Overlay */}
				{dragPreview &&
					(() => {
						const originalTrack = tracks.find(
							(t) => t.id === dragPreview.originalTrackId,
						);
						const clip = originalTrack?.clips?.find(
							(c) => c.id === dragPreview.clipId,
						);
						if (!clip) return null;
						const trackHeight = Math.round(
							DAW_HEIGHTS.TRACK_ROW * trackHeightZoom,
						);
						const targetIndex = tracks.findIndex(
							(t) => t.id === dragPreview.previewTrackId,
						);
						const left = dragPreview.previewStartTime * pixelsPerMs;
						const top = Math.max(0, targetIndex) * trackHeight;
						const width = Math.max(
							(clip.trimEnd - clip.trimStart) * pixelsPerMs,
							8,
						);
						const color = clip.color ?? originalTrack?.color ?? "#3b82f6";
						return (
							<div
								key="drag-preview"
								className="absolute rounded-md pointer-events-none"
								style={{
									left,
									top,
									width,
									height: trackHeight - 2,
									backgroundColor: `${color}33`,
									border: `2px dashed ${color}`,
									zIndex: 1000,
								}}
							/>
						);
					})()}

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
			</div>

			{/* Automation dialog removed in favor of default-move with Undo */}
		</>
	);
}
