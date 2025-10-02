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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useClipInspector } from "@/lib/hooks/use-clip-inspector";
import type { TrackEnvelopeCurve } from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";
import { CurvePreview } from "../controls/curve-preview";
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
		updateClip,
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
			<DrawerContent className="flex h-[80vh] flex-col">
				<DrawerHeader className="shrink-0 border-b border-border/60 text-left">
					<DrawerTitle>Edit Clip</DrawerTitle>
					<DrawerDescription>
						Adjust envelope automation, fades, and clip properties
					</DrawerDescription>
				</DrawerHeader>

				<div className="flex-1 overflow-hidden">
					<ScrollArea className="h-full px-4">
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
												Volume {track.volume}% ·{" "}
												{track.muted ? "Muted" : "Active"}
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
								<div className="space-y-4">
									{/* Fade In */}
									<div className="space-y-3">
										<label
											className="text-sm font-medium text-foreground"
											htmlFor="fade-in-input"
										>
											Fade In
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

										{/* Fade In Curve Type */}
										<div className="space-y-1.5">
											<label
												className="text-xs font-medium text-muted-foreground"
												htmlFor="fade-in-curve"
											>
												Curve Type
											</label>
											<Select
												value={clip.fadeInCurve || "easeOut"}
												onValueChange={(value) =>
													updateClip({
														fadeInCurve: value as TrackEnvelopeCurve,
													})
												}
											>
												<SelectTrigger id="fade-in-curve">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="linear">Linear</SelectItem>
													<SelectItem value="easeIn">Exponential</SelectItem>
													<SelectItem value="easeOut">
														Logarithmic (Natural)
													</SelectItem>
													<SelectItem value="sCurve">
														S-Curve (Smooth)
													</SelectItem>
												</SelectContent>
											</Select>
										</div>

										{/* Fade In Shape */}
										{clip.fadeInCurve && clip.fadeInCurve !== "linear" && (
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<label
														htmlFor="fade-in-shape"
														className="text-xs font-medium text-muted-foreground"
													>
														Shape
													</label>
													<span className="text-xs font-mono text-muted-foreground tabular-nums">
														{((clip.fadeInShape ?? 0.5) * 100).toFixed(0)}%
													</span>
												</div>
												<input
													id="fade-in-shape"
													type="range"
													min={0}
													max={100}
													value={(clip.fadeInShape ?? 0.5) * 100}
													onChange={(e) =>
														updateClip({
															fadeInShape: parseInt(e.target.value, 10) / 100,
														})
													}
													className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-muted hover:bg-muted/80 transition-colors"
												/>
												<CurvePreview
													type={clip.fadeInCurve}
													shape={clip.fadeInShape ?? 0.5}
													width={120}
													height={48}
													className="mx-auto text-primary"
												/>
											</div>
										)}
									</div>

									{/* Fade Out */}
									<div className="space-y-3">
										<label
											className="text-sm font-medium text-foreground"
											htmlFor="fade-out-input"
										>
											Fade Out
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

										{/* Fade Out Curve Type */}
										<div className="space-y-1.5">
											<label
												className="text-xs font-medium text-muted-foreground"
												htmlFor="fade-out-curve"
											>
												Curve Type
											</label>
											<Select
												value={clip.fadeOutCurve || "easeOut"}
												onValueChange={(value) =>
													updateClip({
														fadeOutCurve: value as TrackEnvelopeCurve,
													})
												}
											>
												<SelectTrigger id="fade-out-curve">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="linear">Linear</SelectItem>
													<SelectItem value="easeIn">Exponential</SelectItem>
													<SelectItem value="easeOut">
														Logarithmic (Natural)
													</SelectItem>
													<SelectItem value="sCurve">
														S-Curve (Smooth)
													</SelectItem>
												</SelectContent>
											</Select>
										</div>

										{/* Fade Out Shape */}
										{clip.fadeOutCurve && clip.fadeOutCurve !== "linear" && (
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<label
														htmlFor="fade-out-shape"
														className="text-xs font-medium text-muted-foreground"
													>
														Shape
													</label>
													<span className="text-xs font-mono text-muted-foreground tabular-nums">
														{((clip.fadeOutShape ?? 0.5) * 100).toFixed(0)}%
													</span>
												</div>
												<input
													id="fade-out-shape"
													type="range"
													min={0}
													max={100}
													value={(clip.fadeOutShape ?? 0.5) * 100}
													onChange={(e) =>
														updateClip({
															fadeOutShape: parseInt(e.target.value, 10) / 100,
														})
													}
													className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-muted hover:bg-muted/80 transition-colors"
												/>
												<CurvePreview
													type={clip.fadeOutCurve}
													shape={clip.fadeOutShape ?? 0.5}
													width={120}
													height={48}
													className="mx-auto text-primary"
												/>
											</div>
										)}
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
				</div>

				<DrawerFooter className="shrink-0 border-t border-border/60">
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
