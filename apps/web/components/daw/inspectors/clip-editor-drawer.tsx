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
import { useClipInspector } from "@/lib/daw-sdk";
import { formatDuration } from "@/lib/storage/opfs";
import { SegmentCurvePreview } from "../controls/segment-curve-preview";
import { EnvelopeEditor } from "./envelope-editor";
import { InspectorCard, InspectorSection } from "./inspector-section";

// OLD curve metadata removed - now using simple -99 to +99 system (Logic Pro style)

export function ClipEditorDrawer() {
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
		updateClip,
		MAX_FADE_MS,
	} = useClipInspector();

	if (!current) {
		return null;
	}

	const { track, clip } = current;
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

										{/* Fade In Curve (Logic Pro style: -99 to +99) */}
										{(clip.fadeIn ?? 0) > 0 && (
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<label
														htmlFor="fade-in-curve"
														className="text-xs font-medium text-muted-foreground"
													>
														Fade Curve
													</label>
													<span className="text-xs font-mono text-muted-foreground tabular-nums">
														{clip.fadeInCurve ?? 0}
													</span>
												</div>
												<input
													id="fade-in-curve"
													type="range"
													min={-99}
													max={99}
													step={1}
													value={clip.fadeInCurve ?? 0}
													onChange={(e) =>
														updateClip({
															fadeInCurve: parseInt(e.target.value, 10),
														})
													}
													className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-muted hover:bg-muted/80 transition-colors"
													style={{
														background: `linear-gradient(to right, 
														hsl(var(--primary) / 0.3) 0%, 
														hsl(var(--primary) / 0.6) ${(((clip.fadeInCurve ?? 0) + 99) / 198) * 100}%, 
														hsl(var(--muted)) ${(((clip.fadeInCurve ?? 0) + 99) / 198) * 100}%
													)`,
													}}
												/>
												<div className="flex justify-between text-[10px] text-muted-foreground">
													<span>-99 (Fast)</span>
													<span>0 (Linear)</span>
													<span>+99 (Slow)</span>
												</div>
												<div className="text-[10px] text-muted-foreground text-center">
													{(clip.fadeInCurve ?? 0) === 0
														? "Linear"
														: (clip.fadeInCurve ?? 0) < 0
															? `Exponential - Fast attack, slow end`
															: `Logarithmic - Slow attack, fast end`}
												</div>
												<SegmentCurvePreview
													curve={clip.fadeInCurve ?? 0}
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

										{/* Fade Out Curve (Logic Pro style: -99 to +99) */}
										{(clip.fadeOut ?? 0) > 0 && (
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<label
														htmlFor="fade-out-curve"
														className="text-xs font-medium text-muted-foreground"
													>
														Fade Curve
													</label>
													<span className="text-xs font-mono text-muted-foreground tabular-nums">
														{clip.fadeOutCurve ?? 0}
													</span>
												</div>
												<input
													id="fade-out-curve"
													type="range"
													min={-99}
													max={99}
													step={1}
													value={clip.fadeOutCurve ?? 0}
													onChange={(e) =>
														updateClip({
															fadeOutCurve: parseInt(e.target.value, 10),
														})
													}
													className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-muted hover:bg-muted/80 transition-colors"
													style={{
														background: `linear-gradient(to right, 
														hsl(var(--primary) / 0.3) 0%, 
														hsl(var(--primary) / 0.6) ${(((clip.fadeOutCurve ?? 0) + 99) / 198) * 100}%, 
														hsl(var(--muted)) ${(((clip.fadeOutCurve ?? 0) + 99) / 198) * 100}%
													)`,
													}}
												/>
												<div className="flex justify-between text-[10px] text-muted-foreground">
													<span>-99 (Fast)</span>
													<span>0 (Linear)</span>
													<span>+99 (Slow)</span>
												</div>
												<div className="text-[10px] text-muted-foreground text-center">
													{(clip.fadeOutCurve ?? 0) === 0
														? "Linear"
														: (clip.fadeOutCurve ?? 0) < 0
															? `Exponential - Fast attack, slow end`
															: `Logarithmic - Slow attack, fast end`}
												</div>
												<SegmentCurvePreview
													curve={clip.fadeOutCurve ?? 0}
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
										envelope={envelope}
										onChange={handleEnvelopeChange}
										clipStartTime={clip.startTime}
										trackVolume={track.volume ?? 75}
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
