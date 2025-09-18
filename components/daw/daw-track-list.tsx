"use client";

import { useAtom } from "jotai";
import {
	Edit3,
	Headphones,
	MoreVertical,
	Plus,
	Trash2,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	addTrackAtom,
	removeTrackAtom,
	selectedTrackIdAtom,
	tracksAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

const TRACK_COLORS = [
	"#3b82f6", // blue
	"#ef4444", // red
	"#10b981", // green
	"#f59e0b", // yellow
	"#8b5cf6", // purple
	"#06b6d4", // cyan
	"#f97316", // orange
	"#84cc16", // lime
];

export function DAWTrackList() {
	const [tracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [, addTrack] = useAtom(addTrackAtom);
	const [, removeTrack] = useAtom(removeTrackAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [editingTrackId, setEditingTrackId] = useState<string | null>(null);

	const handleAddTrack = () => {
		const trackNumber = tracks.length + 1;
		const colorIndex = tracks.length % TRACK_COLORS.length;

		addTrack({
			name: `Track ${trackNumber}`,
			duration: 0,
			startTime: 0,
			trimStart: 0,
			trimEnd: 0,
			volume: 75,
			muted: false,
			soloed: false,
			color: TRACK_COLORS[colorIndex],
		});
	};

	const handleTrackNameChange = (trackId: string, name: string) => {
		updateTrack(trackId, { name });
		setEditingTrackId(null);
	};

	const handleVolumeChange = (trackId: string, volume: number) => {
		updateTrack(trackId, { volume });
	};

	const toggleMute = (trackId: string, currentMuted: boolean) => {
		updateTrack(trackId, { muted: !currentMuted });
	};

	const toggleSolo = (trackId: string, currentSoloed: boolean) => {
		updateTrack(trackId, { soloed: !currentSoloed });
	};

	return (
		<div className="h-full flex flex-col">
			{/* Header */}
			<div className="h-16 border-b flex items-center justify-between px-3">
				<h3 className="text-sm font-medium">Tracks</h3>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleAddTrack}
					className="h-8 w-8 p-0"
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>

			{/* Track List */}
			<ScrollArea className="flex-1">
				<div className="p-2 space-y-2">
					{tracks.map((track) => (
						<div
							key={track.id}
							className={`p-3 rounded-lg border transition-colors w-full text-left ${
								selectedTrackId === track.id
									? "bg-muted border-primary"
									: "bg-background hover:bg-muted/50"
							}`}
						>
							{/* Track Header */}
							<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-2 flex-1">
								{editingTrackId === track.id ? (
									<>
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: track.color }}
										/>
										<Input
											value={track.name}
											onChange={(e) =>
												handleTrackNameChange(track.id, e.target.value)
											}
											onBlur={() => setEditingTrackId(null)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													setEditingTrackId(null)
												}
											}}
											className="h-6 text-sm flex-1"
											autoFocus
										/>
									</>
								) : (
									<button
										type="button"
										className="flex items-center gap-2 flex-1 text-left bg-transparent border-none p-0 cursor-pointer"
										onClick={() => setSelectedTrackId(track.id)}
										onDoubleClick={(e) => {
											e.preventDefault()
											setEditingTrackId(track.id)
										}}
									>
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: track.color }}
										/>
										<span className="text-sm font-medium flex-1">
											{track.name}
										</span>
									</button>
								)}
							</div>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0"
											onClick={(e) => e.stopPropagation()}
										>
											<MoreVertical className="w-3 h-3" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={() => setEditingTrackId(track.id)}
										>
											<Edit3 className="w-4 h-4 mr-2" />
											Rename
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => removeTrack(track.id)}
											className="text-destructive"
										>
											<Trash2 className="w-4 h-4 mr-2" />
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							{/* Track Info */}
							<div className="text-xs text-muted-foreground mb-3">
								{track.duration > 0
									? formatDuration(track.duration / 1000)
									: "Empty"}
							</div>

							{/* Track Controls */}
							<div className="flex items-center gap-2">
								<Button
									variant={track.muted ? "default" : "ghost"}
									size="sm"
									className="h-7 w-7 p-0"
									onClick={(e) => {
										e.stopPropagation();
										toggleMute(track.id, track.muted);
									}}
								>
									{track.muted ? (
										<VolumeX className="w-3 h-3" />
									) : (
										<Volume2 className="w-3 h-3" />
									)}
								</Button>

								<Button
									variant={track.soloed ? "default" : "ghost"}
									size="sm"
									className="h-7 w-7 p-0"
									onClick={(e) => {
										e.stopPropagation();
										toggleSolo(track.id, track.soloed);
									}}
								>
									<Headphones className="w-3 h-3" />
								</Button>

								<div className="flex-1">
									<input
										type="range"
										min={0}
										max={100}
										value={track.volume}
										onChange={(e) =>
											handleVolumeChange(track.id, parseInt(e.target.value))
										}
										onClick={(e) => e.stopPropagation()}
										className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer"
									/>
								</div>

								<span className="text-xs text-muted-foreground w-8">
									{track.volume}
								</span>
							</div>
							</div>
					))}

					{tracks.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							<p className="text-sm mb-2">No tracks yet</p>
							<Button variant="outline" size="sm" onClick={handleAddTrack}>
								<Plus className="w-4 h-4 mr-2" />
								Add Track
							</Button>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
