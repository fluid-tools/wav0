"use client";

import { useAtom } from "jotai";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	type TrackEnvelopePoint,
	tracksAtom,
	updateClipAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

const MAX_FADE_MS = 120_000;
const DEFAULT_ENVELOPE_GAIN = 100; // percent

const curveItems: Array<{ label: string; value: TrackEnvelopePoint["curve"] }> =
	[
		{ label: "Linear", value: "linear" },
		{ label: "Ease in", value: "easeIn" },
		{ label: "Ease out", value: "easeOut" },
		{ label: "S-curve", value: "sCurve" },
	];

export function ClipInspectorSheet() {
	const [open, setOpen] = useAtom(clipInspectorOpenAtom);
	const [target, setTarget] = useAtom(clipInspectorTargetAtom);
	const [tracks] = useAtom(tracksAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);

	const [fadeInDraft, setFadeInDraft] = useState<number>(0);
	const [fadeOutDraft, setFadeOutDraft] = useState<number>(0);
	const [envelopeDraft, setEnvelopeDraft] = useState<TrackEnvelopePoint[]>([]);

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
		const points = current.track.volumeEnvelope?.points ?? [];
		setEnvelopeDraft(points.map((point) => ({ ...point })));
	}, [
		current?.clip.id,
		current?.clip.fadeIn,
		current?.clip.fadeOut,
		current?.track.volumeEnvelope?.points,
	]);

	const close = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setTarget(null);
		}
	};

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

	const handleToggleEnvelope = () => {
		if (!current) return;
		const existing = current.track.volumeEnvelope ?? {
			enabled: false,
			points: [
				{
					id: crypto.randomUUID(),
					time: clip.startTime,
					value: (track.volume ?? 100) / 100,
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

	const handleEnvelopePointChange = (
		index: number,
		updates: Partial<TrackEnvelopePoint>,
	) => {
		setEnvelopeDraft((prev) =>
			prev.map((point, idx) =>
				idx === index ? { ...point, ...updates } : point,
			),
		);
	};

	const handleEnvelopePointRemove = (index: number) => {
		setEnvelopeDraft((prev) => prev.filter((_, idx) => idx !== index));
	};

	const handleEnvelopePointAdd = () => {
		setEnvelopeDraft((prev) => {
			const last = prev.at(-1);
			const nextTime = last ? last.time + 500 : clip.startTime;
			return [
				...prev,
				{
					id: crypto.randomUUID(),
					time: nextTime,
					value: DEFAULT_ENVELOPE_GAIN / 100,
					curve: "linear",
				},
			];
		});
	};

	const persistEnvelope = () => {
		if (!current) return;
		const normalized = envelopeDraft
			.map((point) => ({
				...point,
				time: Math.max(0, Math.round(point.time)),
				value: Math.min(4, Math.max(0, point.value)),
			}))
			.sort((a, b) => a.time - b.time);

		updateTrack(current.track.id, {
			volumeEnvelope: {
				enabled: true,
				points: normalized,
			},
		});
	};

	const commitFade = (key: "fadeIn" | "fadeOut", raw: number) => {
		const clamped = Number.isFinite(raw)
			? Math.max(0, Math.min(MAX_FADE_MS, Math.round(raw)))
			: 0;
		updateClip(current.track.id, current.clip.id, { [key]: clamped });
		if (key === "fadeIn") setFadeInDraft(clamped);
		if (key === "fadeOut") setFadeOutDraft(clamped);
	};

	return (
		<Sheet open={open} onOpenChange={close}>
			<SheetContent
				side="right"
				className="flex h-full w-full flex-col gap-0 border-l border-border/60 bg-background/95 px-0 pb-0 pt-0 backdrop-blur sm:w-[520px]"
			>
				<SheetHeader className="space-y-1 border-b border-border/60 px-6 py-5 text-left">
					<SheetTitle className="text-lg font-semibold tracking-tight">
						Clip Inspector
					</SheetTitle>
					<SheetDescription className="text-sm text-muted-foreground">
						Inspect timeline clips, edit envelopes, and adjust fades without
						leaving the grid.
					</SheetDescription>
				</SheetHeader>

				<ScrollArea className="flex-1">
					<div className="space-y-8 px-6 py-6">
						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									Clip
								</span>
								<Badge
									variant="outline"
									className="font-mono text-[11px] uppercase"
								>
									{clip.audioFileType ?? "source"}
								</Badge>
							</div>
							<div className="rounded-2xl border border-border/70 bg-muted/10 p-4 shadow-sm">
								<div className="flex flex-col gap-1">
									<span className="text-base font-semibold leading-tight text-foreground">
										{clip.name || "Untitled clip"}
									</span>
									<span className="text-xs text-muted-foreground">
										{clip.audioFileName ?? `${clip.id}.audio`}
									</span>
								</div>
								<dl className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
									<div className="space-y-1">
										<dt className="text-[10px] uppercase tracking-wide">
											Start
										</dt>
										<dd className="font-medium text-foreground">
											{formatDuration(clip.startTime)}
										</dd>
									</div>
									<div className="space-y-1">
										<dt className="text-[10px] uppercase tracking-wide">
											Trim window
										</dt>
										<dd className="font-medium text-foreground">
											{formatDuration(clip.trimStart)} –{" "}
											{formatDuration(clip.trimEnd)}
										</dd>
									</div>
									<div className="space-y-1">
										<dt className="text-[10px] uppercase tracking-wide">
											Playable length
										</dt>
										<dd className="font-medium text-foreground">
											{formatDuration(clip.trimEnd - clip.trimStart)}
										</dd>
									</div>
								</dl>
							</div>
						</section>

						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									Track
								</span>
								<Button
									variant="secondary"
									size="sm"
									onClick={handleToggleEnvelope}
								>
									{envelopeEnabled ? "Disable Envelope" : "Enable Envelope"}
								</Button>
							</div>
							<div className="rounded-2xl border border-border/70 bg-muted/10 p-4 shadow-sm space-y-4">
								<div className="flex items-start justify-between gap-3">
									<div className="flex flex-col gap-1">
										<span className="text-base font-semibold leading-tight text-foreground">
											{track.name}
										</span>
										<span className="text-xs text-muted-foreground">
											Volume {track.volume}% ·{" "}
											{track.muted ? "Muted" : "Active"}
										</span>
									</div>
									<Badge variant="outline" className="capitalize">
										{track.soloed ? "Solo" : "Normal"}
									</Badge>
								</div>

								{envelopeEnabled ? (
									<div className="space-y-3 rounded-xl border border-dashed border-primary/40 bg-background/40 p-4">
										<header className="flex items-center justify-between">
											<div className="text-xs font-medium text-muted-foreground">
												Envelope points · {envelopeDraft.length}
											</div>
											<div className="flex items-center gap-2">
												<Button
													variant="ghost"
													size="icon-sm"
													onClick={handleEnvelopePointAdd}
												>
													<Plus className="size-4" />
													<span className="sr-only">Add envelope point</span>
												</Button>
												<Button
													variant="outline"
													size="xs"
													onClick={persistEnvelope}
												>
													Save envelope
												</Button>
											</div>
										</header>

										<div className="space-y-3">
											{envelopeDraft.length === 0 ? (
												<p className="text-xs text-muted-foreground">
													No points yet. Add one to begin shaping the gain
													curve.
												</p>
											) : (
												envelopeDraft.map((point, index) => (
													<div
														key={point.id}
														className="grid gap-2 rounded-lg border border-border/50 bg-background/70 px-3 py-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
													>
														<div className="space-y-1">
															<label className="text-[10px] uppercase tracking-wide text-muted-foreground">
																Time (ms)
															</label>
															<Input
																type="number"
																min={0}
																value={Math.round(point.time)}
																onChange={(event) =>
																	handleEnvelopePointChange(index, {
																		time: Number(event.target.value) || 0,
																	})
																}
															/>
														</div>
														<div className="space-y-1">
															<label className="text-[10px] uppercase tracking-wide text-muted-foreground">
																Gain (%)
															</label>
															<Input
																type="number"
																min={0}
																max={400}
																value={Math.round(point.value * 100)}
																onChange={(event) =>
																	handleEnvelopePointChange(index, {
																		value:
																			(Number(event.target.value) || 0) / 100,
																	})
																}
															/>
														</div>
														<div className="space-y-1">
															<label className="text-[10px] uppercase tracking-wide text-muted-foreground">
																Curve
															</label>
															<Select
																value={point.curve ?? "linear"}
																onValueChange={(value) =>
																	handleEnvelopePointChange(index, {
																		curve: value as TrackEnvelopePoint["curve"],
																	})
																}
															>
																<SelectTrigger className="h-9 text-sm">
																	<SelectValue placeholder="Curve" />
																</SelectTrigger>
																<SelectContent>
																	{curveItems.map((item) => (
																		<SelectItem
																			key={item.value}
																			value={item.value}
																		>
																			{item.label}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
														</div>
														<div className="flex items-end justify-end">
															<Button
																variant="ghost"
																size="icon-sm"
																onClick={() => handleEnvelopePointRemove(index)}
																disabled={envelopeDraft.length <= 1}
															>
																<X className="size-4" />
																<span className="sr-only">Remove point</span>
															</Button>
														</div>
													</div>
												))
											)}
										</div>
									</div>
								) : (
									<p className="rounded-xl border border-dashed border-border/60 bg-background/40 p-4 text-xs text-muted-foreground">
										Envelope disabled — enable to author dynamic volume ramps.
									</p>
								)}
							</div>
						</section>

						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									Fades
								</span>
								<span className="text-xs text-muted-foreground">
									Values in milliseconds
								</span>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1">
									<label
										className="text-[10px] uppercase tracking-wide text-muted-foreground"
										htmlFor="fade-in-input"
									>
										Fade in
									</label>
									<Input
										id="fade-in-input"
										type="number"
										min={0}
										max={MAX_FADE_MS}
										value={fadeInDraft.toString()}
										onChange={(event) =>
											setFadeInDraft(Number(event.target.value) || 0)
										}
										onBlur={() => commitFade("fadeIn", fadeInDraft)}
										onKeyDown={(event) => {
											if (event.key === "Enter") event.currentTarget.blur();
										}}
									/>
								</div>
								<div className="space-y-1">
									<label
										className="text-[10px] uppercase tracking-wide text-muted-foreground"
										htmlFor="fade-out-input"
									>
										Fade out
									</label>
									<Input
										id="fade-out-input"
										type="number"
										min={0}
										max={MAX_FADE_MS}
										value={fadeOutDraft.toString()}
										onChange={(event) =>
											setFadeOutDraft(Number(event.target.value) || 0)
										}
										onBlur={() => commitFade("fadeOut", fadeOutDraft)}
										onKeyDown={(event) => {
											if (event.key === "Enter") event.currentTarget.blur();
										}}
									/>
								</div>
							</div>
						</section>

						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									File metadata
								</span>
							</div>
							<div className="rounded-2xl border border-border/70 bg-muted/10 p-4 shadow-sm text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">OPFS ID</span>
									<span className="font-mono text-xs break-all text-foreground">
										{clip.opfsFileId}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Type</span>
									<span className="text-foreground">
										{clip.audioFileType ?? "Unknown"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Status</span>
									<span className="text-foreground">Stored in OPFS</span>
								</div>
							</div>
						</section>

						<Separator />

						<section className="space-y-2">
							<span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								AI Toolkit (prototype)
							</span>
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

				<SheetFooter className="flex items-center justify-between border-t border-border/60 bg-background/80 px-6 py-4">
					<div className="text-xs text-muted-foreground">
						Changes apply instantly. Envelope edits require “Save envelope”.
					</div>
					<SheetClose asChild>
						<Button variant="outline">Close</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
