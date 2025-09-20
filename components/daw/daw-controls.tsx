"use client";

import { useAtom } from "jotai";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import {
	DAW_BUTTONS,
	DAW_HEIGHTS,
	DAW_ICONS,
	DAW_TEXT,
} from "@/lib/constants/daw-design";
import {
	playbackAtom,
	setBpmAtom,
	setCurrentTimeAtom,
	setTimelineZoomAtom,
	setTrackHeightZoomAtom,
	stopPlaybackAtom,
	timelineAtom,
	togglePlaybackAtom,
	totalDurationAtom,
	trackHeightZoomAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWControls() {
	const [playback] = useAtom(playbackAtom);
	const [timeline] = useAtom(timelineAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [, togglePlayback] = useAtom(togglePlaybackAtom);
	const [, stopPlayback] = useAtom(stopPlaybackAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, setBpm] = useAtom(setBpmAtom);
	const [, setTimelineZoom] = useAtom(setTimelineZoomAtom);
	const [, setTrackHeightZoom] = useAtom(setTrackHeightZoomAtom);
	const [totalDuration] = useAtom(totalDurationAtom);

	const handleStop = async () => {
		try {
			await stopPlayback();
		} catch (error) {
			console.error("Failed to stop playback:", error);
		}
	};

	const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const time = parseFloat(e.target.value);
		// Clamp to project duration (don't allow past yellow marker)
		const clampedTime = Math.min(Math.max(0, time), totalDuration);
		setCurrentTime(clampedTime);
	};

	const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const bpm = parseInt(e.target.value, 10);
		setBpm(bpm);
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

	return (
		<div
			className="bg-muted/30 border-b flex items-center justify-between px-4"
			style={{ height: DAW_HEIGHTS.CONTROLS }}
		>
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm">
						<SkipBack className={DAW_ICONS.MD} />
					</Button>
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
					>
						{playback.isPlaying ? (
							<Pause className={DAW_ICONS.LG} />
						) : (
							<Play className={DAW_ICONS.LG} />
						)}
					</Button>
					<Button variant="ghost" size="sm" onClick={handleStop}>
						<Square className={DAW_ICONS.MD} />
					</Button>
					<Button variant="ghost" size="sm">
						<SkipForward className={DAW_ICONS.MD} />
					</Button>
				</div>

				<div
					className={`flex items-center gap-3 ${DAW_BUTTONS.PANEL} px-3 py-1.5`}
				>
					<span className={`${DAW_TEXT.MONO_TIME} min-w-14`}>
						{formatDuration(playback.currentTime / 1000)}
					</span>
					<div className="relative flex-1">
						<input
							type="range"
							min={0}
							max={totalDuration}
							value={playback.currentTime}
							onChange={handleTimeChange}
							className="w-48 h-1.5 bg-muted/50 rounded-full appearance-none cursor-pointer slider"
							style={{
								background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${
									(playback.currentTime / totalDuration) * 100
								}%, hsl(var(--muted)) ${
									(playback.currentTime / totalDuration) * 100
								}%, hsl(var(--muted)) 100%)`,
							}}
						/>
					</div>
					<span className={`${DAW_TEXT.MONO_TIME} min-w-14`}>
						{formatDuration(totalDuration / 1000)}
					</span>
				</div>
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

				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">BPM</span>
					<Input
						type="number"
						value={playback.bpm}
						onChange={handleBpmChange}
						className="w-16 text-sm"
						style={{ height: DAW_HEIGHTS.BUTTON_MD }}
						min={60}
						max={200}
					/>
				</div>
				<Button variant={playback.looping ? "default" : "ghost"} size="sm">
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
			</div>
		</div>
	);
}
