"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useClipInspector } from "@/lib/hooks/use-clip-inspector";
import { formatDuration } from "@/lib/storage/opfs";
import { EnvelopeEditor } from "./envelope-editor";
import { InspectorCard, InspectorSection } from "./inspector-section";

export function ClipEditorDrawer() {
	const {
		open,
		current,
		fadeInDraft,
		fadeOutDraft,
		envelopeDraft,
		setFadeInDraft,
		setFadeOutDraft,
		close,
		handleToggleEnvelope,
		handleEnvelopeChange,
		handleEnvelopeSave,
		commitFade,
		MAX_FADE_MS,
	} = useClipInspector();

	if (!current) {
		return null;
	}

	const { track, clip } = current;
	const envelope = track.volumeEnvelope;
	const envelopeEnabled = Boolean(envelope?.enabled);

	return (
		<Drawer open={open} onOpenChange={close}>
			<DrawerContent className="flex max-h-[90vh] flex-col overflow-hidden">
				<DrawerHeader className="shrink-0 text-left">
					<DrawerTitle>Edit Clip</DrawerTitle>
					<DrawerDescription>
						Adjust envelope automation, fades, and clip properties
					</DrawerDescription>
				</DrawerHeader>

				<ScrollArea className="flex-1 overflow-hidden px-4">
					<div className="mx-auto max-w-4xl space-y-6 pb-6">
						{/* Clip Overview */}
						<InspectorSection
							title="Clip"
							action={
								<Badge variant="outline" className="font-mono text-[11px]">
									{clip.audioFileType ?? "audio"}
								</Badge>
							}
						>
							<InspectorCard>
								<div className="flex flex-col gap-1">
									<span className="text-base font-semibold leading-tight">
										{clip.name || "Untitled clip"}
									</span>
									<span className="text-xs text-muted-foreground">
										{clip.audioFileName ?? `${clip.id}.audio`}
									</span>
								</div>
								<dl className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
									<div className="space-y-1">
										<dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
											Start
										</dt>
										<dd className="font-medium text-foreground">
											{formatDuration(clip.startTime)}
										</dd>
									</div>
									<div className="space-y-1">
										<dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
											Trim Start
										</dt>
										<dd className="font-medium text-foreground">
											{formatDuration(clip.trimStart)}
										</dd>
									</div>
									<div className="space-y-1">
										<dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
											Trim End
										</dt>
										<dd className="font-medium text-foreground">
											{formatDuration(clip.trimEnd)}
										</dd>
									</div>
									<div className="space-y-1">
										<dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
											Length
										</dt>
										<dd className="font-medium text-foreground">
											{formatDuration(clip.trimEnd - clip.trimStart)}
										</dd>
									</div>
								</dl>
							</InspectorCard>
						</InspectorSection>

						{/* Track Info */}
						<InspectorSection title="Track">
							<InspectorCard>
								<div className="flex items-start justify-between gap-3">
									<div className="flex flex-col gap-1">
										<span className="text-base font-semibold leading-tight">
											{track.name}
										</span>
										<span className="text-xs text-muted-foreground">
											Volume {track.volume}% · {track.muted ? "Muted" : "Active"}
										</span>
									</div>
									<Badge variant="outline" className="capitalize">
										{track.soloed ? "Solo" : "Normal"}
									</Badge>
								</div>
							</InspectorCard>
						</InspectorSection>

						{/* Fades */}
						<InspectorSection
							title="Fades"
							action={
								<span className="text-xs text-muted-foreground">
									Milliseconds
								</span>
							}
						>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-2">
									<label
										className="text-xs font-medium text-muted-foreground"
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
								<div className="space-y-2">
									<label
										className="text-xs font-medium text-muted-foreground"
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

						<Separator />

						{/* Volume Automation */}
						<InspectorSection
							title="Volume Automation"
							action={
								<Button
									variant="secondary"
									size="sm"
									onClick={handleToggleEnvelope}
								>
									{envelopeEnabled ? "Disable" : "Enable"}
								</Button>
							}
						>
							{envelopeEnabled ? (
								<EnvelopeEditor
									points={envelopeDraft}
									onChange={handleEnvelopeChange}
									onSave={handleEnvelopeSave}
									clipStartTime={clip.startTime}
									trackVolume={track.volume}
								/>
							) : (
								<InspectorCard>
									<p className="text-sm text-muted-foreground">
										Volume automation is disabled. Enable it to create dynamic
										volume changes over time using automation points.
									</p>
								</InspectorCard>
							)}
						</InspectorSection>
					</div>
				</ScrollArea>

				<DrawerFooter className="shrink-0">
					<div className="flex w-full items-center justify-between gap-3">
						<p className="text-xs text-muted-foreground">
							Changes apply instantly. Save envelope to persist automation.
						</p>
						<DrawerClose asChild>
							<Button variant="outline">Done</Button>
						</DrawerClose>
					</div>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

