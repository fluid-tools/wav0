"use client";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { projectNameAtom, tracksAtom } from "@/lib/daw-sdk";
import { createPreviewPlayer } from "@/lib/daw-sdk/core/preview-player";
import { renderProjectToAudioBuffer } from "@/lib/daw-sdk/core/render-service";
import { loopRegionAtom } from "@/lib/daw-sdk/state/timeline";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function ExportDialog({ open, onOpenChange }: Props) {
	const [fmt, setFmt] = useState<"wav" | "flac" | "m4a" | "ogg">("wav");
	const [sr, setSr] = useState(48000);
	const [ch, setCh] = useState<1 | 2>(2);
	const [range, setRange] = useState<"entire" | "loop" | "custom">("entire");
	const [customStart, setCustomStart] = useState(0);
	const [customEnd, setCustomEnd] = useState(60000);
	const [progress, setProgress] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [previewBuffer, setPreviewBuffer] = useState<AudioBuffer | null>(null);
	const [previewVol, setPreviewVol] = useState(1);
	const playerRef = useRef<ReturnType<typeof createPreviewPlayer> | null>(null);
	const [tracks] = useAtom(tracksAtom);
	const [projectName] = useAtom(projectNameAtom);
	const [loopRegion] = useAtom(loopRegionAtom);

	async function onPreview() {
		try {
			setBusy(true);
			setProgress(null);
			const { startMs, endMs } = getRangeMs();
			const buffer = await renderProjectToAudioBuffer(
				{ tracks },
				{ startMs, endMs, sampleRate: sr, channels: ch },
			);
			setPreviewBuffer(buffer);
			if (!playerRef.current) playerRef.current = createPreviewPlayer();
			playerRef.current.load(buffer);
			playerRef.current.setGain(previewVol);
		} finally {
			setBusy(false);
		}
	}

	function playPreview() {
		if (!previewBuffer) return;
		if (!playerRef.current) playerRef.current = createPreviewPlayer();
		playerRef.current.load(previewBuffer);
		playerRef.current.setGain(previewVol);
		playerRef.current.play();
	}

	function pausePreview() {
		playerRef.current?.pause();
	}

	function stopPreview() {
		playerRef.current?.stop();
	}

	useEffect(() => {
		if (!open) {
			playerRef.current?.stop();
		}
		return () => {
			playerRef.current?.dispose();
			playerRef.current = null;
		};
	}, [open]);

	function getRangeMs() {
		if (range === "loop" && loopRegion.enabled) {
			return { startMs: loopRegion.startMs, endMs: loopRegion.endMs };
		}
		if (range === "custom") {
			return { startMs: customStart, endMs: customEnd };
		}
		return {
			startMs: 0,
			endMs: Math.max(...tracks.map((t) => t.duration), 60000),
		};
	}

	async function onExport() {
		try {
			setBusy(true);
			setProgress(null);
			const { startMs, endMs } = getRangeMs();
			const buffer = await renderProjectToAudioBuffer(
				{ tracks },
				{ startMs, endMs, sampleRate: sr, channels: ch },
			);
			const { audioBufferToWav } = await import(
				"@/lib/daw-sdk/utils/audio-buffer"
			);
			const wavBytes: Uint8Array = audioBufferToWav(buffer, { bitDepth: 16 });
			let bytes = wavBytes;
			let ext = "wav";
			if (fmt !== "wav") {
				const { encode } = await import("@/lib/daw-sdk/core/encode-service");
				bytes = await encode(wavBytes, fmt, (p) => setProgress(p));
				ext = fmt === "m4a" ? "m4a" : fmt;
			}
			const blob = new Blob([bytes], {
				type: fmt === "m4a" ? "audio/mp4" : `audio/${ext}`,
			});
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `${projectName || "export"}_${Date.now()}.${ext}`;
			a.click();
			URL.revokeObjectURL(a.href);
		} finally {
			setBusy(false);
			setProgress(null);
			onOpenChange(false);
		}
	}

	const stats = previewBuffer
		? (() => {
				const peaks: number[] = [];
				const rms: number[] = [];

				for (let ch = 0; ch < previewBuffer.numberOfChannels; ch++) {
					const data = previewBuffer.getChannelData(ch);
					let peak = 0;
					let sumSq = 0;

					for (let i = 0; i < data.length; i++) {
						const abs = Math.abs(data[i]);
						if (abs > peak) peak = abs;
						sumSq += data[i] * data[i];
					}

					peaks.push(peak);
					rms.push(Math.sqrt(sumSq / data.length));
				}

				return {
					duration: previewBuffer.duration.toFixed(2),
					sampleRate: previewBuffer.sampleRate,
					channels: previewBuffer.numberOfChannels,
					peak: peaks.map((p) => p.toFixed(3)).join(", "),
					rms: rms.map((r) => r.toFixed(3)).join(", "),
				};
			})()
		: null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Export</DialogTitle>
				</DialogHeader>
				<div className="grid grid-cols-2 gap-3 text-sm">
					<label className="flex items-center gap-2">
						Range
						<select
							className="border rounded px-2 py-1"
							value={range}
							onChange={(e) =>
								setRange(e.target.value as "entire" | "loop" | "custom")
							}
						>
							<option value="entire">Entire</option>
							<option value="loop" disabled={!loopRegion.enabled}>
								Loop
							</option>
							<option value="custom">Custom</option>
						</select>
					</label>
					{range === "custom" && (
						<>
							<label className="flex items-center gap-2">
								Start (ms)
								<input
									type="number"
									className="border rounded px-2 py-1 w-20"
									value={customStart}
									onChange={(e) => setCustomStart(Number(e.target.value))}
								/>
							</label>
							<label className="flex items-center gap-2">
								End (ms)
								<input
									type="number"
									className="border rounded px-2 py-1 w-20"
									value={customEnd}
									onChange={(e) => setCustomEnd(Number(e.target.value))}
								/>
							</label>
						</>
					)}
					<label className="flex items-center gap-2">
						Format
						<select
							className="border rounded px-2 py-1"
							value={fmt}
							onChange={(e) =>
								setFmt(e.target.value as "wav" | "flac" | "m4a" | "ogg")
							}
						>
							<option value="wav">WAV</option>
							<option value="flac">FLAC</option>
							<option value="m4a">AAC (M4A)</option>
							<option value="ogg">OGG (Opus)</option>
						</select>
					</label>
					<label className="flex items-center gap-2">
						Sample rate
						<select
							className="border rounded px-2 py-1"
							value={sr}
							onChange={(e) => setSr(Number(e.target.value))}
						>
							{[44100, 48000].map((v) => (
								<option key={v} value={v}>
									{v}
								</option>
							))}
						</select>
					</label>
					<label className="flex items-center gap-2">
						Channels
						<select
							className="border rounded px-2 py-1"
							value={ch}
							onChange={(e) => setCh(Number(e.target.value) as 1 | 2)}
						>
							<option value={1}>Mono</option>
							<option value={2}>Stereo</option>
						</select>
					</label>
				</div>
				{progress !== null && (
					<div className="w-full h-2 bg-muted rounded">
						<div
							className="h-2 bg-primary rounded"
							style={{ width: `${Math.round(progress * 100)}%` }}
						/>
					</div>
				)}
				{stats && (
					<div className="text-xs font-mono border rounded p-2 bg-muted/20">
						<div>Duration: {stats.duration}s</div>
						<div>SR: {stats.sampleRate}</div>
						<div>Channels: {stats.channels}</div>
						<div>Peak: {stats.peak}</div>
						<div>RMS: {stats.rms}</div>
						<div className="mt-2 text-muted-foreground">
							Est. size: {(() => {
								const durSec = parseFloat(stats.duration);
								const bytesPerSec = stats.sampleRate * stats.channels * 2; // 16-bit
								const wavBytes = durSec * bytesPerSec;
								const formatSizes = {
									wav: wavBytes,
									flac: wavBytes * 0.4, // ~40% compression
									m4a: (durSec * 128000) / 8, // 128kbps AAC
									ogg: (durSec * 192000) / 8, // 192kbps Opus
								};
								const estBytes = formatSizes[fmt];
								const mb = (estBytes / (1024 * 1024)).toFixed(1);
								return `${mb} MB (${fmt.toUpperCase()})`;
							})()}
						</div>
						{previewBuffer && (
							<div className="mt-2 flex items-center gap-2">
								<Button size="xs" variant="outline" onClick={playPreview}>
									Play
								</Button>
								<Button size="xs" variant="outline" onClick={pausePreview}>
									Pause
								</Button>
								<Button size="xs" variant="outline" onClick={stopPreview}>
									Stop
								</Button>
								<label className="flex items-center gap-1">
									<span>Vol</span>
									<input
										type="range"
										min={0}
										max={1}
										step={0.01}
										value={previewVol}
										onChange={(e) => {
											const v = Number(e.target.value);
											setPreviewVol(v);
											playerRef.current?.setGain(v);
										}}
										className="w-24"
									/>
								</label>
							</div>
						)}
					</div>
				)}
				<div className="flex justify-end gap-2">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={busy}
					>
						Cancel
					</Button>
					<Button variant="outline" onClick={onPreview} disabled={busy}>
						Preview
					</Button>
					<Button onClick={onExport} disabled={busy}>
						Export
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
