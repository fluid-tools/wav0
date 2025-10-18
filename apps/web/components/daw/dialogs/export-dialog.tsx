"use client";
import { useAtom } from "jotai";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { projectNameAtom, tracksAtom } from "@/lib/daw-sdk";
import { renderProjectToAudioBuffer } from "@/lib/daw-sdk/core/render-service";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function ExportDialog({ open, onOpenChange }: Props) {
	const [fmt, setFmt] = useState<"wav" | "flac" | "m4a" | "ogg">("wav");
	const [sr, setSr] = useState(48000);
	const [ch, setCh] = useState<1 | 2>(2);
	const [progress, setProgress] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [tracks] = useAtom(tracksAtom);
	const [projectName] = useAtom(projectNameAtom);

	async function onExport() {
		try {
			setBusy(true);
			setProgress(null);
			const buffer = await renderProjectToAudioBuffer(
				{ tracks },
				{ sampleRate: sr, channels: ch },
			);
			// @ts-expect-error implement audioBufferToWav later
			const wavBytes: Uint8Array = await (
				await import("@/lib/daw-sdk/utils/audio-buffer")
			).audioBufferToWav(buffer, { bitDepth: 16 });
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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Export</DialogTitle>
				</DialogHeader>
				<div className="grid grid-cols-2 gap-3 text-sm">
					<label className="flex items-center gap-2">
						Format
						<select
							className="border rounded px-2 py-1"
							value={fmt}
							onChange={(e) => setFmt(e.target.value as any)}
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
				<div className="flex justify-end gap-2">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={busy}
					>
						Cancel
					</Button>
					<Button onClick={onExport} disabled={busy}>
						Export
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
