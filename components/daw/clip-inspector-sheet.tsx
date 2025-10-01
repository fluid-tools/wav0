"use client";

import { useAtom } from "jotai";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function ClipInspectorSheet() {
	const [open, setOpen] = useAtom(clipInspectorOpenAtom);
	const [target, setTarget] = useAtom(clipInspectorTargetAtom);
	const [tracks] = useAtom(tracksAtom);

	const current = useMemo(() => {
		if (!target) return null;
		const track = tracks.find((candidate) => candidate.id === target.trackId);
		const clip = track?.clips?.find(
			(candidate) => candidate.id === target.clipId,
		);
		return track && clip
			? {
					track,
					clip,
				}
			: null;
	}, [target, tracks]);

	const close = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setTarget(null);
		}
	};

	return (
		<Sheet open={open && Boolean(current)} onOpenChange={close}>
			<SheetContent side="right" className="w-full sm:w-[480px] lg:w-[560px]">
				<SheetHeader className="space-y-3">
					<SheetTitle>Clip Inspector</SheetTitle>
					<SheetDescription>
						Inspect timeline clips, view source metadata, and queue AI-assisted
						modifications (coming soon).
					</SheetDescription>
				</SheetHeader>
				{current ? (
					<div className="space-y-6 py-4">
						<section className="space-y-2">
							<h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
								Clip
							</h3>
							<div className="rounded-md border bg-muted/30 p-3 space-y-2">
								<div className="flex flex-col gap-1">
									<span className="font-semibold text-base">
										{current.clip.name || "Untitled Clip"}
									</span>
									<span className="text-sm text-muted-foreground">
										{current.clip.audioFileName ?? "OPFS Asset"}
									</span>
								</div>
								<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
									<Badge variant="outline">
										Start {formatDuration(current.clip.startTime)}
									</Badge>
									<Badge variant="outline">
										Trim {formatDuration(current.clip.trimStart)} –{" "}
										{formatDuration(current.clip.trimEnd)}
									</Badge>
									<Badge variant="outline">
										Length{" "}
										{formatDuration(
											current.clip.trimEnd - current.clip.trimStart,
										)}
									</Badge>
								</div>
							</div>
						</section>

						<section className="space-y-2">
							<h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
								Track
							</h3>
							<div className="rounded-md border bg-muted/30 p-3 space-y-2">
								<div className="flex items-center justify-between">
									<div className="flex flex-col gap-1">
										<span className="font-semibold text-base">
											{current.track.name}
										</span>
										<span className="text-sm text-muted-foreground">
											Volume {current.track.volume}% ·{" "}
											{current.track.muted ? "Muted" : "Active"}
										</span>
									</div>
									<Badge variant="outline" className="capitalize">
										{current.track.soloed ? "Solo" : "Normal"}
									</Badge>
								</div>
								{current.track.volumeEnvelope?.enabled ? (
									<div className="text-xs text-muted-foreground">
										Envelope points:{" "}
										{current.track.volumeEnvelope.points.length}
									</div>
								) : (
									<div className="text-xs text-muted-foreground">
										Envelope disabled
									</div>
								)}
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
										{current.clip.opfsFileId}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Type</span>
									<span>{current.clip.audioFileType ?? "Unknown"}</span>
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
				) : null}
				<SheetFooter className="gap-2 pt-4">
					<SheetClose asChild>
						<Button variant="outline">Close</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
