"use client";

import { useAtom } from "jotai";
import {
	Edit3,
	Headphones,
	MoreVertical,
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
import { DAW_ROW_HEIGHT } from "@/lib/constants";
import {
	removeTrackAtom,
	selectedTrackIdAtom,
	tracksAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";


export function DAWTrackList() {
	const [tracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [, removeTrack] = useAtom(removeTrackAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [editingTrackId, setEditingTrackId] = useState<string | null>(null);

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
		<div className="w-full">
			{/* Track List */}
			<div>
				{tracks.map((track) => (
					<div
						key={track.id}
						className={`w-full border-b transition-colors ${
							selectedTrackId === track.id
								? "bg-muted border-primary"
								: "bg-background hover:bg-muted/50"
						}`}
						style={{ 
							height: DAW_ROW_HEIGHT,
							padding: '12px',
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'space-between'
						}}
					>
						{/* Track Header */}
						<button
							type="button"
							className="flex items-center justify-between cursor-pointer w-full bg-transparent border-none p-0 text-left"
							onClick={() => setSelectedTrackId(track.id)}
						>
							<div className="flex items-center gap-2 flex-1 min-w-0">
								<div
									className="w-3 h-3 rounded-full flex-shrink-0"
									style={{ backgroundColor: track.color }}
								/>
								{editingTrackId === track.id ? (
									<Input
										value={track.name}
										onChange={(e) =>
											handleTrackNameChange(track.id, e.target.value)
										}
										onBlur={() => setEditingTrackId(null)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												setEditingTrackId(null);
											}
										}}
										className="h-6 text-sm"
										autoFocus
										onClick={(e) => e.stopPropagation()}
									/>
								) : (
									<button
										type="button"
										className="text-sm font-medium truncate text-left bg-transparent border-none p-0 cursor-pointer hover:underline"
										onDoubleClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setEditingTrackId(track.id);
										}}
										onClick={(e) => e.stopPropagation()}
									>
										{track.name}
									</button>
								)}
							</div>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0 flex-shrink-0"
										onClick={(e) => e.stopPropagation()}
									>
										<MoreVertical className="w-3 h-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={(e) => {
											e.stopPropagation();
											setEditingTrackId(track.id);
										}}
									>
										<Edit3 className="w-4 h-4 mr-2" />
										Rename
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={(e) => {
											e.stopPropagation();
											removeTrack(track.id);
										}}
										className="text-destructive"
									>
										<Trash2 className="w-4 h-4 mr-2" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
								</DropdownMenu>
						</button>

						{/* Track Info */}
						<div className="text-xs text-muted-foreground">
							{track.duration > 0
								? formatDuration(track.duration / 1000)
								: "Empty"}
						</div>

						{/* Track Controls */}
						<div className="flex items-center gap-2">
							<Button
								variant={track.muted ? "default" : "ghost"}
								size="sm"
								className="h-6 w-6 p-0 flex-shrink-0"
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
								className="h-6 w-6 p-0 flex-shrink-0"
								onClick={(e) => {
									e.stopPropagation();
									toggleSolo(track.id, track.soloed);
								}}
							>
								<Headphones className="w-3 h-3" />
							</Button>

							<div className="flex-1 min-w-0">
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

							<span className="text-xs text-muted-foreground w-8 text-right flex-shrink-0">
								{track.volume}
							</span>
						</div>
					</div>
					))}

				{tracks.length === 0 && (
					<div className="text-center py-8 text-muted-foreground px-4">
						<p className="text-sm">No tracks yet. Use the + button above to add tracks.</p>
					</div>
				)}
			</div>
		</div>
	);
}