"use client";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
	const [showPreviewLanes, setShowPreviewLanes] = useState(false);
	const playerRef = useRef<ReturnType<typeof createPreviewPlayer> | null>(null);
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
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

	const getRangeMs = useCallback(() => {
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
	}, [range, loopRegion, customStart, customEnd, tracks]);

	const renderPreviewLanes = useCallback(() => {
		const canvas = previewCanvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const { startMs, endMs } = getRangeMs();
		const canvasWidth = 400;
		const canvasHeight = Math.min(tracks.length * 20 + 40, 200);

		// Setup HiDPI scaling
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.max(1, Math.floor(canvasWidth * dpr));
		canvas.height = Math.max(1, Math.floor(canvasHeight * dpr));
		canvas.style.width = `${canvasWidth}px`;
		canvas.style.height = `${canvasHeight}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		if (endMs <= startMs) return;

		// Get theme colors from CSS variables
		const styles = getComputedStyle(canvas);
		const trackBgEven = styles.getPropertyValue("--muted").trim() || "hsl(210 40% 98%)";
		const trackBgOdd = styles.getPropertyValue("--muted-foreground").trim() || "hsl(210 40% 96%)";
		const clipFill = styles.getPropertyValue("--primary").trim() || "hsl(221.2 83.2% 53.3%)";
		const labelColor = styles.getPropertyValue("--muted-foreground").trim() || "hsl(215.4 16.3% 46.9%)";
		const gridColor = styles.getPropertyValue("--border").trim() || "hsl(214.3 31.8% 91.4%)";

		const pxPerMs = canvasWidth / (endMs - startMs);
		const rowHeight = 16;
		const padding = 4;

		// Draw tracks
		tracks.forEach((track, trackIndex) => {
			const y = trackIndex * rowHeight + padding;

			// Draw track background with theme colors
			ctx.fillStyle = trackIndex % 2 === 0 ? trackBgEven : trackBgOdd;
			ctx.fillRect(0, y, canvasWidth, rowHeight - 2);

			// Draw track clips
			track.clips?.forEach((clip) => {
				// Calculate audible windows
				const trimStart = clip.trimStart || 0;
				const trimEnd = clip.trimEnd || clip.sourceDurationMs || 0;
				const clipDuration = trimEnd - trimStart;

				if (clipDuration <= 0) return;

				const audibleStart = Math.max(clip.startTime, startMs);
				const audibleEnd = Math.min(clip.startTime + clipDuration, endMs);

				// Handle looped clips
				if (clip.loop) {
					const cycleLen = clipDuration;
					const loopEnd = clip.loopEnd || Infinity;

					// Find first cycle start within range
					let firstCycleStart = clip.startTime;
					if (startMs > clip.startTime) {
						const cyclesOffset = Math.ceil(
							(startMs - clip.startTime) / cycleLen,
						);
						firstCycleStart = clip.startTime + cyclesOffset * cycleLen;
					}

					// Tile cycles across the range
					let currentStart = firstCycleStart;
					while (currentStart < endMs && currentStart < loopEnd) {
						const currentEnd = Math.min(
							currentStart + cycleLen,
							endMs,
							loopEnd,
						);
						if (currentEnd > startMs) {
							const x = (currentStart - startMs) * pxPerMs;
							const w = (currentEnd - currentStart) * pxPerMs;

							// Draw rounded clip rectangle
							ctx.fillStyle = clipFill;
							ctx.beginPath();
							ctx.roundRect(x, y + 2, w, rowHeight - 6, 2);
							ctx.fill();
							
							// Draw subtle outline
							ctx.strokeStyle = clipFill;
							ctx.lineWidth = 0.5;
							ctx.stroke();
						}
						currentStart += cycleLen;
					}
				} else {
					// One-shot clip
					if (audibleEnd > audibleStart) {
						const x = (audibleStart - startMs) * pxPerMs;
						const w = (audibleEnd - audibleStart) * pxPerMs;

						// Draw rounded clip rectangle
						ctx.fillStyle = clipFill;
						ctx.beginPath();
						ctx.roundRect(x, y + 2, w, rowHeight - 6, 2);
						ctx.fill();
						
						// Draw subtle outline
						ctx.strokeStyle = clipFill;
						ctx.lineWidth = 0.5;
						ctx.stroke();
					}
				}
			});

			// Draw track label with theme color
			ctx.fillStyle = labelColor;
			ctx.font = "10px sans-serif";
			ctx.fillText(`Track ${trackIndex + 1}`, 4, y + 12);
		});

		// Draw time markers with theme colors
		ctx.strokeStyle = gridColor;
		ctx.lineWidth = 1;
		const timeStep = (endMs - startMs) / 8; // 8 time markers
		for (let i = 0; i <= 8; i++) {
			const timeMs = startMs + i * timeStep;
			const x = (timeMs - startMs) * pxPerMs;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, canvasHeight);
			ctx.stroke();

			// Time label with theme color
			ctx.fillStyle = labelColor;
			ctx.font = "8px sans-serif";
			ctx.fillText(`${(timeMs / 1000).toFixed(1)}s`, x + 2, 12);
		}
	}, [tracks, getRangeMs]);

	// Render preview lanes when tracks/range changes
	useEffect(() => {
		if (showPreviewLanes) {
			renderPreviewLanes();
		}
	}, [showPreviewLanes, renderPreviewLanes]);

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
			const blob = new Blob([bytes as BlobPart], {
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
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Export</DialogTitle>
				</DialogHeader>
				<div className="grid grid-cols-3 gap-4 text-sm">
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
					<div className="border rounded-md p-3 bg-muted/5">
						<div className="text-xs font-mono space-y-1">
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
						</div>
						{previewBuffer && (
							<div className="mt-3 flex items-center gap-2">
								<Button size="sm" variant="outline" onClick={playPreview}>
									Play
								</Button>
								<Button size="sm" variant="outline" onClick={pausePreview}>
									Pause
								</Button>
								<Button size="sm" variant="outline" onClick={stopPreview}>
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
				<Collapsible open={showPreviewLanes} onOpenChange={setShowPreviewLanes}>
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="w-full">
							{showPreviewLanes ? "Hide" : "Show"} Preview Lanes
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="mt-2 border rounded p-2 bg-muted/10">
							<div className="text-xs text-muted-foreground mb-2">
								Visual preview of audible content in export range
							</div>
							<canvas
								ref={previewCanvasRef}
								className="border rounded bg-white"
								style={{ maxWidth: "100%", height: "auto" }}
							/>
						</div>
					</CollapsibleContent>
				</Collapsible>
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
