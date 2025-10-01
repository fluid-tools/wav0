"use client";

import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	clipInspectorOpenAtom,
	clipInspectorTargetAtom,
	tracksAtom,
	updateClipAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

const MAX_FADE_MS = 120000;
const ENVELOPE_PREVIEW_LIMIT = 6;


export function ClipInspectorSheet() {
	const [open, setOpen] = useAtom(clipInspectorOpenAtom);
	const [target, setTarget] = useAtom(clipInspectorTargetAtom);
	const [tracks] = useAtom(tracksAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);

	const [fadeInDraft, setFadeInDraft] = useState<number>(0);
	const [fadeOutDraft, setFadeOutDraft] = useState<number>(0);

	const current = useMemo(() => {
		if (!target) return null;
		const track = tracks.find((candidate) => candidate.id === target.trackId);
		const clip = track?.clips?.find(
			(candidate) => candidate.id === target.clipId,
		);
		return track && clip ? { track, clip } : null;
	}, [target, tracks]);

	useEffect(() => {
		if (!current) return;
	setFadeInDraft(current.clip.fadeIn ?? 0);
	setFadeOutDraft(current.clip.fadeOut ?? 0);
}, [current?.clip.id, current?.clip.fadeIn, current?.clip.fadeOut]);

	const close = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setTarget(null);
		}
	};

	const toggleEnvelope = () => {
		if (!current) return;
		const existing = current.track.volumeEnvelope ?? {
			enabled: false,
			points: [
				{
					id: crypto.randomUUID(),
					time: 0,
					value: current.track.volume / 100,
					curve: "linear" as const,
				},
			],
		};
		updateTrack(current.track.id, {
			volumeEnvelope: {
				...existing,
				enabled: !existing.enabled,
			},
		});
	};

	const commitFade = (key: "fadeIn" | "fadeOut", raw: number) => {
		if (!current) return;
	const clamped = Number.isFinite(raw)
		? Math.max(0, Math.min(MAX_FADE_MS, Math.round(raw)))
		: 0;
		updateClip(current.track.id, current.clip.id, { [key]: clamped });
		if (key === "fadeIn") setFadeInDraft(clamped);
		if (key === "fadeOut") setFadeOutDraft(clamped);
	};

const fadeValueToString = (value: number) =>
	Number.isFinite(value) ? value.toString() : "0";

	if (!current) {
		return (
			<Sheet open={false}>
				<SheetContent side="right" className="hidden" />
			</Sheet>
		);
	}

	const { track, clip } = current;
	const envelope = track.volumeEnvelope;
	const envelopeEnabled = Boolean(envelope?.enabled);
	const envelopePreview =
		envelope?.points.slice(0, ENVELOPE_PREVIEW_LIMIT) ?? [];

	return (
		<Sheet open={open} onOpenChange={close}>
			<SheetContent
				side="right"
				className="flex h-full w-full flex-col gap-0 sm:w-[480px] lg:w-[560px]"
			>
				<SheetHeader className="space-y-3">
					<SheetTitle>Clip Inspector</SheetTitle>
					<SheetDescription>
						Inspect timeline clips, view source metadata, and queue AI-assisted
						modifications (coming soon).
					</SheetDescription>
				</SheetHeader>

				<ScrollArea className="flex-1 pr-1">
					<div className="space-y-6 py-4 pr-3">
						<section className="space-y-2">
							<h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
								Clip
							</h3>
							<div className="rounded-md border bg-muted/30 p-3 space-y-2">
								<div className="flex flex-col gap-1">
									<span className="font-semibold text-base">
										{clip.name || "Untitled Clip"}
									</span>
									<span className="text-sm text-muted-foreground">
										{clip.audioFileName ?? "OPFS Asset"}
									</span>
								</div>
								<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
									<Badge variant="outline">
										Start {formatDuration(clip.startTime)}
									</Badge>
									<Badge variant="outline">
										Trim {formatDuration(clip.trimStart)} –{" "}
										{formatDuration(clip.trimEnd)}
									</Badge>
									<Badge variant="outline">
										Length {formatDuration(clip.trimEnd - clip.trimStart)}
									</Badge>
								</div>
							</div>
						</section>

						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
									Track
								</h3>
								<Button variant="secondary" size="sm" onClick={toggleEnvelope}>
									{envelopeEnabled ? "Disable Envelope" : "Enable Envelope"}
								</Button>
							</div>
							<div className="rounded-md border bg-muted/30 p-3 space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex flex-col gap-1">
										<span className="font-semibold text-base">
											{track.name}
										</span>
										<span className="text-sm text-muted-foreground">
											Volume {track.volume}% ·{" "}
											{track.muted ? "Muted" : "Active"}
										</span>
									</div>
									<Badge variant="outline" className="capitalize">
										{track.soloed ? "Solo" : "Normal"}
									</Badge>
								</div>
								{envelopeEnabled ? (
									<div className="space-y-2 rounded-sm border border-dashed border-primary/40 bg-background/50 p-3 text-xs text-muted-foreground">
										<p>Envelope animates track gain over time. First points:</p>
										<ul className="space-y-1 font-mono">
											{envelopePreview.map((point) => (
												<li key={point.id}>
													{Math.round(point.time)}ms →{" "}
													{(point.value * 100).toFixed(0)}%
													{point.curve ? ` · ${point.curve}` : ""}
												</li>
											))}
											{envelope &&
											envelope.points.length > ENVELOPE_PREVIEW_LIMIT ? (
												<li>…</li>
											) : null}
										</ul>
									</div>
								) : (
									<div className="text-xs text-muted-foreground">
										Envelope disabled — enable to author dynamic volume ramps.
									</div>
								)}
							</div>
						</section>

						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
									Fades
								</h3>
								<span className="text-xs text-muted-foreground">
									Values in milliseconds
								</span>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1">
									<label
										className="text-xs text-muted-foreground"
										htmlFor="fade-in-input"
									>
										Fade in
									</label>
									<Input
										id="fade-in-input"
										type="number"
										min={0}
										max={MAX_FADE_MS}
										value={fadeValueToString(fadeInDraft)}
										onChange={(event) => {
											const next = Number(event.target.value);
											setFadeInDraft(Number.isFinite(next) ? next : 0);
										}}
										onBlur={() => commitFade("fadeIn", fadeInDraft)}
										onKeyDown={(event) => {
											if (event.key === "Enter") {
												event.currentTarget.blur();
											}
										}}
									/>
								</div>
								<div className="space-y-1">
									<label
										className="text-xs text-muted-foreground"
										htmlFor="fade-out-input"
									>
										Fade out
									</label>
									<Input
										id="fade-out-input"
										type="number"
										min={0}
										max={MAX_FADE_MS}
										value={fadeValueToString(fadeOutDraft)}
										onChange={(event) => {
											const next = Number(event.target.value);
											setFadeOutDraft(Number.isFinite(next) ? next : 0);
										}}
										onBlur={() => commitFade("fadeOut", fadeOutDraft)}
										onKeyDown={(event) => {
											if (event.key === "Enter") {
												event.currentTarget.blur();
											}
										}}
									/>
								</div>
							</div>
						</section>

						<section className="space-y-2">
							<h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
								File Metadata
							</h3>
							<div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">OPFS ID</span>
									<span className="font-mono text-xs break-all">
										{clip.opfsFileId}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Type</span>
									<span>{clip.audioFileType ?? "Unknown"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Status</span>
									<span>Stored in OPFS</span>
								</div>
							</div>
						</section>

						<Separator />

						<section className="space-y-2">
							<h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
								AI Toolkit (Prototype)
							</h3>
							<div className="grid gap-2 sm:grid-cols-2">
								<Button variant="secondary" className="justify-start gap-2">
									<span>Suggest mix move</span>
									<span className="text-xs text-muted-foreground">
										Coming soon
									</span>
								</Button>
								<Button variant="secondary" className="justify-start gap-2">
									<span>Generate variation</span>
									<span className="text-xs text-muted-foreground">
										Coming soon
									</span>
								</Button>
							</div>
						</section>
					</div>
				</ScrollArea>

				<SheetFooter className="gap-2 pt-4">
					<SheetClose asChild>
						<Button variant="outline">Close</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
