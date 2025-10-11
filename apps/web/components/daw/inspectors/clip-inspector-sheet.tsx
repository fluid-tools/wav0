"use client";

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
import { useClipInspector } from "@/lib/daw-sdk";
import { formatDuration } from "@/lib/storage/opfs";
import { EnvelopeEditor } from "./envelope-editor";
import { InspectorCard, InspectorSection } from "./inspector-section";

export function ClipInspectorSheet() {
	const {
		open,
		current,
		fadeInDraft,
		fadeOutDraft,
		envelope,
		setFadeInDraft,
		setFadeOutDraft,
		close,
		handleToggleEnvelope,
		handleEnvelopeChange,
		commitFade,
		MAX_FADE_MS,
	} = useClipInspector();

	if (!current) {
		return (
			<Sheet open={false}>
				<SheetContent side="right" className="hidden" />
			</Sheet>
		);
	}

	const { track, clip } = current;
	const envelopeEnabled = Boolean(envelope?.enabled);

	return (
		<Sheet open={open} onOpenChange={close}>
			<SheetContent
				side="right"
				className="flex h-full w-full flex-col gap-0 border-l border-border/60 bg-background/95 p-0 backdrop-blur sm:w-[520px]"
			>
				<SheetHeader className="shrink-0 space-y-1 border-b border-border/60 px-6 py-5 text-left">
					<SheetTitle className="text-lg font-semibold tracking-tight">
						Clip Inspector
					</SheetTitle>
					<SheetDescription className="text-sm text-muted-foreground">
						Inspect timeline clips, edit envelopes, and adjust fades without
						leaving the grid.
					</SheetDescription>
				</SheetHeader>

				<ScrollArea className="flex-1 overflow-hidden">
					<div className="space-y-8 px-6 py-6 pb-4">
						<InspectorSection
							title="Clip"
							action={
								<Badge
									variant="outline"
									className="font-mono text-[11px] uppercase"
								>
									{clip.audioFileType ?? "source"}
								</Badge>
							}
						>
							<InspectorCard>
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
							</InspectorCard>
						</InspectorSection>

						<InspectorSection
							title="Track"
							action={
								<Button
									variant="secondary"
									size="sm"
									onClick={handleToggleEnvelope}
								>
									{envelopeEnabled ? "Disable Envelope" : "Enable Envelope"}
								</Button>
							}
						>
							<InspectorCard className="space-y-4">
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
							<EnvelopeEditor
								envelope={envelope}
								onChange={handleEnvelopeChange}
								clipStartTime={clip.startTime}
								trackVolume={track.volume}
							/>
						) : (
									<p className="rounded-xl border border-dashed border-border/60 bg-background/40 p-4 text-xs text-muted-foreground">
										Envelope disabled — enable to author dynamic volume ramps.
									</p>
								)}
							</InspectorCard>
						</InspectorSection>

						<InspectorSection
							title="Fades"
							action={
								<span className="text-xs text-muted-foreground">
									Values in milliseconds
								</span>
							}
						>
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
										aria-label="Fade in duration in milliseconds"
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
										aria-label="Fade out duration in milliseconds"
									/>
								</div>
							</div>
						</InspectorSection>

						<InspectorSection title="File metadata">
							<InspectorCard className="space-y-2 text-sm">
								<div className="flex justify-between gap-4">
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
							</InspectorCard>
						</InspectorSection>

						<Separator />

						<InspectorSection title="AI Toolkit (prototype)">
							<div className="grid gap-2 sm:grid-cols-2">
								<Button
									variant="secondary"
									className="justify-start gap-2"
									aria-label="Suggest mix move (coming soon)"
								>
									<span>Suggest mix move</span>
									<span className="text-xs text-muted-foreground">
										Coming soon
									</span>
								</Button>
								<Button
									variant="secondary"
									className="justify-start gap-2"
									aria-label="Generate variation (coming soon)"
								>
									<span>Generate variation</span>
									<span className="text-xs text-muted-foreground">
										Coming soon
									</span>
								</Button>
							</div>
						</InspectorSection>
					</div>
				</ScrollArea>

				<SheetFooter className="shrink-0 flex items-center justify-between border-t border-border/60 bg-background/80 px-6 py-4">
					<div className="text-xs text-muted-foreground">
						Changes apply instantly. Envelope edits require "Save envelope".
					</div>
					<SheetClose asChild>
						<Button variant="outline">Close</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
