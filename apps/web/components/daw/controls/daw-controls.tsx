"use client";

import {
	isPlayingAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	setTimelineZoomAtom,
	setTrackHeightZoomAtom,
	stopPlaybackAtom,
	timelineAtom,
	togglePlaybackAtom,
	trackHeightZoomAtom,
	tracksAtom,
	updateClipAtom,
	useDAWContext,
} from "@wav0/daw-react";
import { computeLoopEndMs } from "@wav0/daw-sdk";
import { useAtomValue, useSetAtom } from "jotai";
import {
	ChevronsUpDown,
	Pause,
	Play,
	Repeat,
	SkipBack,
	SkipForward,
	Square,
	Volume2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
	DAW_BUTTONS,
	DAW_HEIGHTS,
	DAW_ICONS,
	DAW_TEXT,
} from "@/lib/constants/daw-design";
import { MasterMeter } from "./master-meter";
import { TimeControls } from "./time-display";

// Isolated play button - only this re-renders on play state change
const PlayPauseButton = memo(function PlayPauseButton() {
	const isPlaying = useAtomValue(isPlayingAtom);
	const togglePlayback = useSetAtom(togglePlaybackAtom);

	return (
		<Button
			variant="default"
			size="sm"
			onClick={async () => {
				try {
					await togglePlayback();
				} catch (error) {
					console.error("Failed to toggle playback:", error);
				}
			}}
			style={{
				width: DAW_HEIGHTS.BUTTON_LG,
				height: DAW_HEIGHTS.BUTTON_LG,
			}}
			aria-label={isPlaying ? "Pause" : "Play"}
		>
			{isPlaying ? (
				<Pause className={DAW_ICONS.LG} />
			) : (
				<Play className={DAW_ICONS.LG} />
			)}
		</Button>
	);
});

// Memoized to prevent re-renders from parent - state is now isolated in TimeControls
const DAWControls = memo(function DAWControls() {
	// isPlayingAtom moved to PlayPauseButton - no longer causes re-render here
	const timeline = useAtomValue(timelineAtom);
	const trackHeightZoom = useAtomValue(trackHeightZoomAtom);
	const stopPlayback = useSetAtom(stopPlaybackAtom);
	const setTimelineZoom = useSetAtom(setTimelineZoomAtom);
	const setTrackHeightZoom = useSetAtom(setTrackHeightZoomAtom);
	const daw = useDAWContext();

	// Selection and clip update atoms
	const selectedTrackId = useAtomValue(selectedTrackIdAtom);
	const selectedClipId = useAtomValue(selectedClipIdAtom);
	const tracks = useAtomValue(tracksAtom);
	const updateClip = useSetAtom(updateClipAtom);

	const handleStop = async () => {
		try {
			await stopPlayback();
		} catch (error) {
			console.error("Failed to stop playback:", error);
		}
	};


	const handleZoomIn = () => {
		setTimelineZoom(Math.min(timeline.zoom * 1.5, 4));
	};

	const handleZoomOut = () => {
		setTimelineZoom(Math.max(timeline.zoom / 1.5, 0.25));
	};

	const handleTrackHeightZoomIn = () => {
		setTrackHeightZoom(Math.min(trackHeightZoom + 0.2, 2.0));
	};

	const handleTrackHeightZoomOut = () => {
		setTrackHeightZoom(Math.max(trackHeightZoom - 0.2, 0.6));
	};

	// Selected clip lookup
	const findSelectedClip = () => {
		if (!selectedTrackId || !selectedClipId)
			return null as {
				track: import("@wav0/daw-sdk").Track;
				clip: import("@wav0/daw-sdk").Clip;
			} | null;
		const track = tracks.find((t) => t.id === selectedTrackId);
		if (!track || !track.clips) return null;
		const clip = track.clips.find((c) => c.id === selectedClipId);
		if (!clip) return null;
		return { track, clip } as const;
	};

	const loopState = (() => {
		const sel = findSelectedClip();
		return sel?.clip?.loop === true;
	})();

	const onToggleLoop = async (e?: React.MouseEvent) => {
		const sel = findSelectedClip();
		if (!sel) return;
		const { track, clip } = sel;
		const isLooping = clip.loop === true;
		if (isLooping) {
			await updateClip(track.id, clip.id, { loop: false, loopEnd: undefined });
			return;
		}
		// enabling loop
		const infinite = !!(e && (e.shiftKey || e.altKey));
		if (infinite) {
			await updateClip(track.id, clip.id, { loop: true, loopEnd: undefined });
			return;
		}
		let loopEnd = clip.loopEnd;
		if (loopEnd === undefined) {
			loopEnd = computeLoopEndMs(clip);
		}
		// If playhead is past computed loopEnd, extend to include current position
		const clipDuration = clip.trimEnd - clip.trimStart;
		const transportTime = daw?.getTransport().getCurrentTime() ?? 0;
		if (clipDuration > 0 && transportTime >= loopEnd) {
			const pastEnd = transportTime - clip.startTime;
			const cycles = Math.ceil(pastEnd / clipDuration);
			loopEnd = clip.startTime + clipDuration * (cycles + 2);
		}
		await updateClip(track.id, clip.id, { loop: true, loopEnd });
	};

	return (
		<div
			className="bg-muted/30 border-b flex items-center justify-between px-4"
			style={{ height: DAW_HEIGHTS.CONTROLS }}
		>
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" aria-label="Skip to beginning">
						<SkipBack className={DAW_ICONS.MD} />
					</Button>
					<PlayPauseButton />
					<Button
						variant="ghost"
						size="sm"
						onClick={handleStop}
						aria-label="Stop"
					>
						<Square className={DAW_ICONS.MD} />
					</Button>
					<Button variant="ghost" size="sm" aria-label="Skip to end">
						<SkipForward className={DAW_ICONS.MD} />
					</Button>
				</div>

				{/* Isolated time controls - updates at 10Hz without re-rendering parent */}
				<TimeControls />
			</div>

			<div className="flex items-center gap-4">
				{/* Horizontal Zoom Controls */}
				<div className={DAW_BUTTONS.CONTROL_GROUP}>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleZoomOut}
						disabled={timeline.zoom <= 0.25}
						style={{
							height: DAW_HEIGHTS.BUTTON_SM,
							width: DAW_HEIGHTS.BUTTON_SM,
						}}
						className="p-0"
						title="Zoom Out Horizontally"
					>
						<ZoomOut className={DAW_ICONS.SM} />
					</Button>
					<span className={`${DAW_TEXT.MONO_TIME} min-w-12 text-center`}>
						{Math.round(timeline.zoom * 100)}%
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleZoomIn}
						disabled={timeline.zoom >= 4}
						style={{
							height: DAW_HEIGHTS.BUTTON_SM,
							width: DAW_HEIGHTS.BUTTON_SM,
						}}
						className="p-0"
						title="Zoom In Horizontally"
					>
						<ZoomIn className={DAW_ICONS.SM} />
					</Button>
				</div>

				{/* Vertical Zoom Controls (Track Height) */}
				<div className={DAW_BUTTONS.CONTROL_GROUP}>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleTrackHeightZoomOut}
						disabled={trackHeightZoom <= 0.6}
						style={{
							height: DAW_HEIGHTS.BUTTON_SM,
							width: DAW_HEIGHTS.BUTTON_SM,
						}}
						className="p-0"
						title="Decrease Track Height"
					>
						<ChevronsUpDown className={`${DAW_ICONS.SM} scale-75`} />
					</Button>
					<span className={`${DAW_TEXT.MONO_TIME} min-w-12 text-center`}>
						{Math.round(trackHeightZoom * 100)}%
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleTrackHeightZoomIn}
						disabled={trackHeightZoom >= 2.0}
						style={{
							height: DAW_HEIGHTS.BUTTON_SM,
							width: DAW_HEIGHTS.BUTTON_SM,
						}}
						className="p-0"
						title="Increase Track Height"
					>
						<ChevronsUpDown className={DAW_ICONS.SM} />
					</Button>
				</div>

				<Button
					variant={loopState ? "secondary" : "ghost"}
					size="sm"
					onClick={(e) => onToggleLoop(e)}
					disabled={!findSelectedClip()}
					title="Toggle loop for selected clip (Shift = infinite)"
					aria-label="Toggle loop for selected clip"
				>
					<Repeat className={DAW_ICONS.MD} />
				</Button>

				<div className="flex items-center gap-2">
					<Volume2 className={`${DAW_ICONS.MD} text-muted-foreground`} />
					<input
						type="range"
						min={0}
						max={100}
						defaultValue={75}
						className="w-16 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
					/>
				</div>

				<div className="flex items-center gap-2 border-l border-border pl-4">
					<span className="text-sm font-medium text-muted-foreground">
						Output
					</span>
					<MasterMeter />
				</div>
			</div>
		</div>
	);
});

export { DAWControls };
