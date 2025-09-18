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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	playbackAtom,
	setBpmAtom,
	setCurrentTimeAtom,
	togglePlaybackAtom,
	totalDurationAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWControls() {
	const [playback] = useAtom(playbackAtom);
	const [, togglePlayback] = useAtom(togglePlaybackAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, setBpm] = useAtom(setBpmAtom);
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

	return (
		<div className="h-16 bg-muted/30 border-b flex items-center justify-center px-4">
			<div className="flex items-center gap-4">
				{/* Transport Controls */}
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

				{/* Timeline Position */}
				<div className="flex items-center gap-3">
					<span className="text-sm font-mono text-muted-foreground min-w-16">
						{formatDuration(playback.currentTime / 1000)}
					</span>

					<input
						type="range"
						min={0}
						max={totalDuration}
						value={playback.currentTime}
						onChange={handleTimeChange}
						className="w-32 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
					/>

					<span className="text-sm font-mono text-muted-foreground min-w-16">
						{formatDuration(totalDuration / 1000)}
					</span>
				</div>

				{/* BPM Control */}
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

				{/* Loop Toggle */}
				<Button variant={playback.looping ? "default" : "ghost"} size="sm">
					<Repeat className="w-4 h-4" />
				</Button>

				{/* Master Volume */}
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
