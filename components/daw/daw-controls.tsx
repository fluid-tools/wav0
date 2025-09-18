"use client";

import { useAtom } from "jotai";
import {
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
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import {
	playbackAtom,
	setBpmAtom,
	setCurrentTimeAtom,
	setTimelineZoomAtom,
	timelineAtom,
	togglePlaybackAtom,
	totalDurationAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWControls() {
	const [playback] = useAtom(playbackAtom);
	const [timeline] = useAtom(timelineAtom);
	const [, togglePlayback] = useAtom(togglePlaybackAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, setBpm] = useAtom(setBpmAtom);
	const [, setTimelineZoom] = useAtom(setTimelineZoomAtom);
	const [totalDuration] = useAtom(totalDurationAtom);

	const handleStop = () => {
		setCurrentTime(0);
		if (playback.isPlaying) {
			togglePlayback();
		}
	};

	const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const time = parseFloat(e.target.value);
		setCurrentTime(time);
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

	return (
		<div className="h-14 bg-muted/30 border-b flex items-center justify-between px-4">
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm">
						<SkipBack className="w-4 h-4" />
					</Button>
					<Button
						variant="default"
						size="sm"
						onClick={togglePlayback}
						className="w-10 h-10"
					>
						{playback.isPlaying ? (
							<Pause className="w-5 h-5" />
						) : (
							<Play className="w-5 h-5" />
						)}
					</Button>
					<Button variant="ghost" size="sm" onClick={handleStop}>
						<Square className="w-4 h-4" />
					</Button>
					<Button variant="ghost" size="sm">
						<SkipForward className="w-4 h-4" />
					</Button>
				</div>

				<div className="flex items-center gap-3 bg-background/50 rounded-lg px-3 py-1.5 border">
					<span className="text-xs font-mono text-muted-foreground min-w-14 tabular-nums">
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
					<span className="text-xs font-mono text-muted-foreground min-w-14 tabular-nums">
						{formatDuration(totalDuration / 1000)}
					</span>
				</div>
			</div>

			<div className="flex items-center gap-4">
				{/* Zoom Controls */}
				<div className="flex items-center gap-1 bg-background/50 rounded-lg border p-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleZoomOut}
						disabled={timeline.zoom <= 0.25}
						className="h-7 w-7 p-0"
						title="Zoom Out"
					>
						<ZoomOut className="w-3.5 h-3.5" />
					</Button>
					<span className="text-xs font-mono text-muted-foreground min-w-12 text-center">
						{Math.round(timeline.zoom * 100)}%
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleZoomIn}
						disabled={timeline.zoom >= 4}
						className="h-7 w-7 p-0"
						title="Zoom In"
					>
						<ZoomIn className="w-3.5 h-3.5" />
					</Button>
				</div>

				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">BPM</span>
					<Input
						type="number"
						value={playback.bpm}
						onChange={handleBpmChange}
						className="w-16 h-8 text-sm"
						min={60}
						max={200}
					/>
				</div>
				<Button variant={playback.looping ? "default" : "ghost"} size="sm">
					<Repeat className="w-4 h-4" />
				</Button>
				<div className="flex items-center gap-2">
					<Volume2 className="w-4 h-4 text-muted-foreground" />
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
