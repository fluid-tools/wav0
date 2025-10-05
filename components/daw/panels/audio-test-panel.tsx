"use client";

import { useAtom } from "jotai";
import {
	ChevronDown,
	ChevronRight,
	Pause,
	Play,
	Square,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { audioService } from "@/lib/daw-sdk";
import {
	loadAudioFileAtom,
	playbackAtom,
	stopPlaybackAtom,
	togglePlaybackAtom,
	tracksAtom,
} from "@/lib/state/daw-store";

export function AudioTestPanel() {
	const [tracks] = useAtom(tracksAtom);
	const [playback] = useAtom(playbackAtom);
	const [, loadAudioFile] = useAtom(loadAudioFileAtom);
	const [, togglePlayback] = useAtom(togglePlaybackAtom);
	const [, stopPlayback] = useAtom(stopPlaybackAtom);
	const [isOpen, setIsOpen] = useState(true);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			await loadAudioFile(file);
			console.log("Audio file loaded successfully");
		} catch (error) {
			console.error("Failed to load audio file:", error);
		}
	};

	const handlePlayPause = async () => {
		try {
			await togglePlayback();
		} catch (error) {
			console.error("Failed to toggle playback:", error);
		}
	};

	const handleStop = async () => {
		try {
			await stopPlayback();
		} catch (error) {
			console.error("Failed to stop playback:", error);
		}
	};

	const testDirectAudioPlay = async () => {
		if (tracks.length === 0) {
			console.log("No tracks loaded");
			return;
		}

		const track = tracks[0];
		if (!track.opfsFileId) {
			console.log("Track has no audio file");
			return;
		}

		try {
			// Use the AudioBufferSink to fetch a small slice and play via Web Audio API
			const sink = audioService.getAudioBufferSink(track.opfsFileId);
			if (!sink) {
				console.log("No sink available for track");
				return;
			}
			const audioContext = await audioService.getAudioContext();
			const baseTime = audioContext.currentTime + 0.05; // slight delay to avoid immediate start drift
			// Play the first ~1s as a sanity test
			for await (const { buffer, timestamp } of sink.buffers(
				0,
				Math.min(track.trimEnd ?? track.duration, 1000) / 1000,
			)) {
				const source = audioContext.createBufferSource();
				source.buffer = buffer;
				source.connect(audioContext.destination);
				// schedule relative to baseTime + timestamp
				source.start(baseTime + (timestamp || 0));
			}
			console.log("Direct audio buffer scheduling started");
		} catch (error) {
			console.error("Direct playback failed:", error);
		}
	};

	return (
		<div className="border rounded-lg bg-muted/30">
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<CollapsibleTrigger asChild>
					<Button variant="ghost" className="w-full justify-between p-4 h-auto">
						<h3 className="text-lg font-semibold">Audio Test Panel</h3>
						{isOpen ? (
							<ChevronDown className="w-4 h-4" />
						) : (
							<ChevronRight className="w-4 h-4" />
						)}
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent className="px-4 pb-4 space-y-4">
					{/* File Upload */}
					<div className="space-y-2">
						<Button
							onClick={() => fileInputRef.current?.click()}
							className="w-full"
							variant="outline"
						>
							<Upload className="w-4 h-4 mr-2" />
							Upload Audio File
						</Button>
						<input
							ref={fileInputRef}
							type="file"
							accept="audio/*"
							onChange={handleFileUpload}
							className="hidden"
						/>
					</div>

					{/* Playback Controls */}
					<div className="flex gap-2">
						<Button onClick={handlePlayPause} variant="default">
							{playback.isPlaying ? (
								<Pause className="w-4 h-4" />
							) : (
								<Play className="w-4 h-4" />
							)}
						</Button>
						<Button onClick={handleStop} variant="outline">
							<Square className="w-4 h-4" />
						</Button>
						<Button onClick={testDirectAudioPlay} variant="outline">
							Test Direct Play
						</Button>
					</div>

					{/* Track Status */}
					<div className="text-sm space-y-1">
						<div>Tracks: {tracks.length}</div>
						<div>Playing: {playback.isPlaying ? "Yes" : "No"}</div>
						<div>Current Time: {(playback.currentTime / 1000).toFixed(1)}s</div>
						{tracks.map((track, index) => (
							<div key={track.id} className="text-xs text-muted-foreground">
								Track {index + 1}: {track.name}
								{track.opfsFileId && " (Audio loaded)"}
								{track.duration > 0 &&
									` - ${(track.duration / 1000).toFixed(1)}s`}
							</div>
						))}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
