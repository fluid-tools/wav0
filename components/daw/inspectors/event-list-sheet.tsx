"use client";

import { useAtom } from "jotai";
import { useMemo, useState } from "react";
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
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { Clip, Track } from "@/lib/state/daw-store";
import {
	clipInspectorOpenAtom,
	clipInspectorTargetAtom,
	eventListOpenAtom,
	tracksAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

type EventRow = {
	trackId: string;
	trackName: string;
	clip: Clip;
	track: Track;
};

export function EventListSheet() {
	const [open, setOpen] = useAtom(eventListOpenAtom);
	const [tracks] = useAtom(tracksAtom);
	const [, setClipInspectorOpen] = useAtom(clipInspectorOpenAtom);
	const [, setClipInspectorTarget] = useAtom(clipInspectorTargetAtom);

	const [filterTrack, setFilterTrack] = useState<string>("all");
	const [searchTerm, setSearchTerm] = useState("");

	// Flatten all clips into event rows
	const allEvents = useMemo(() => {
		const events: EventRow[] = [];
		for (const track of tracks) {
			if (!track.clips) continue;
			for (const clip of track.clips) {
				events.push({
					trackId: track.id,
					trackName: track.name,
					clip,
					track,
				});
			}
		}
		// Sort by start time
		return events.sort((a, b) => a.clip.startTime - b.clip.startTime);
	}, [tracks]);

	// Apply filters
	const filteredEvents = useMemo(() => {
		return allEvents.filter((event) => {
			const matchesTrack =
				filterTrack === "all" || event.trackId === filterTrack;
			const matchesSearch =
				searchTerm === "" ||
				event.clip.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.trackName.toLowerCase().includes(searchTerm.toLowerCase());
			return matchesTrack && matchesSearch;
		});
	}, [allEvents, filterTrack, searchTerm]);

	const handleEditClip = (trackId: string, clipId: string) => {
		setClipInspectorTarget({ trackId, clipId });
		setClipInspectorOpen(true);
	};

	const totalDuration = useMemo(() => {
		if (allEvents.length === 0) return 0;
		return Math.max(
			...allEvents.map(
				(e) => e.clip.startTime + (e.clip.trimEnd - e.clip.trimStart),
			),
		);
	}, [allEvents]);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetContent
				side="right"
				className="flex h-full w-full flex-col gap-0 border-l border-border/60 bg-background/95 p-0 backdrop-blur sm:w-[720px] lg:w-[900px]"
			>
				<SheetHeader className="shrink-0 space-y-1 border-b border-border/60 px-6 py-5 text-left">
					<SheetTitle className="text-lg font-semibold tracking-tight">
						Event List
					</SheetTitle>
					<SheetDescription className="text-sm text-muted-foreground">
						View all clips and events in your project. Click any event to edit
						it.
					</SheetDescription>
				</SheetHeader>

				{/* Filters */}
				<div className="shrink-0 border-b border-border/60 bg-muted/30 px-6 py-3">
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex-1 min-w-[200px]">
							<Input
								placeholder="Search clips..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="h-9"
							/>
						</div>
						<Select value={filterTrack} onValueChange={setFilterTrack}>
							<SelectTrigger className="w-[200px] h-9">
								<SelectValue placeholder="All tracks" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All tracks</SelectItem>
								{tracks.map((track) => (
									<SelectItem key={track.id} value={track.id}>
										{track.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Badge variant="outline" className="font-mono">
							{filteredEvents.length} events
						</Badge>
					</div>
				</div>

				{/* Event Table */}
				<ScrollArea className="flex-1 overflow-hidden">
					<div className="px-6 py-4">
						{filteredEvents.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<p className="text-sm text-muted-foreground">No events found</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{searchTerm || filterTrack !== "all"
										? "Try adjusting your filters"
										: "Add clips to tracks to see them here"}
								</p>
							</div>
						) : (
							<div className="space-y-1">
								{/* Table Header */}
								<div className="sticky top-0 z-10 grid grid-cols-[140px_160px_1fr_100px_100px_80px] gap-3 border-b border-border/60 bg-background/95 pb-2 text-xs font-medium text-muted-foreground backdrop-blur">
									<div>Start</div>
									<div>Track</div>
									<div>Clip Name</div>
									<div className="text-right">Trim Start</div>
									<div className="text-right">Length</div>
									<div className="text-right">Action</div>
								</div>

								{/* Table Rows */}
								{filteredEvents.map((event) => {
									const length = event.clip.trimEnd - event.clip.trimStart;

									return (
										<button
											key={`${event.trackId}-${event.clip.id}`}
											onClick={() =>
												handleEditClip(event.trackId, event.clip.id)
											}
											className="grid w-full grid-cols-[140px_160px_1fr_100px_100px_80px] gap-3 rounded-md border border-transparent px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/30"
										>
											<div className="font-mono text-foreground">
												{formatDuration(event.clip.startTime)}
											</div>
											<div className="truncate text-muted-foreground">
												{event.trackName}
											</div>
											<div className="truncate font-medium text-foreground">
												{event.clip.name || "Untitled"}
											</div>
											<div className="font-mono text-right text-muted-foreground">
												{formatDuration(event.clip.trimStart)}
											</div>
											<div className="font-mono text-right text-muted-foreground">
												{formatDuration(length)}
											</div>
											<div className="text-right">
												<Badge variant="secondary" className="text-xs">
													Edit
												</Badge>
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>
				</ScrollArea>

				{/* Footer Stats */}
				<div className="shrink-0 border-t border-border/60 bg-muted/30 px-6 py-3">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<div className="flex items-center gap-4">
							<span>{tracks.length} tracks</span>
							<span>·</span>
							<span>{allEvents.length} total events</span>
							<span>·</span>
							<span>Duration: {formatDuration(totalDuration)}</span>
						</div>
						<SheetClose asChild>
							<Button variant="outline" size="sm">
								Close
							</Button>
						</SheetClose>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
