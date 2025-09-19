"use client";

import { useAtom } from "jotai";
import {
	Edit3,
	GripHorizontal,
	Headphones,
	MoreVertical,
	Trash2,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DAW_ROW_HEIGHT } from "@/lib/constants";
import { DAW_BUTTONS, DAW_COLORS, DAW_HEIGHTS, DAW_ICONS, DAW_SPACING, DAW_TEXT } from "@/lib/constants/daw-design";
import {
	removeTrackAtom,
	selectedTrackIdAtom,
	setTrackHeightZoomAtom,
	trackHeightZoomAtom,
	tracksAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWTrackList() {
	const [tracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [, setTrackHeightZoom] = useAtom(setTrackHeightZoomAtom);
	const [, removeTrack] = useAtom(removeTrackAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
	const [resizingTrack, setResizingTrack] = useState<{
		startY: number;
		startZoom: number;
	} | null>(null);

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

	const handleResizeStart = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		setResizingTrack({
			startY: e.clientY,
			startZoom: trackHeightZoom,
		});
	}, [trackHeightZoom]);

	const handleResizeMove = useCallback((e: MouseEvent) => {
		if (!resizingTrack) return;
		
		const deltaY = e.clientY - resizingTrack.startY;
		const deltaZoom = deltaY / DAW_HEIGHTS.TRACK_ROW; // Convert pixels to zoom multiplier
		const newZoom = resizingTrack.startZoom + deltaZoom;
		
		setTrackHeightZoom(newZoom);
	}, [resizingTrack, setTrackHeightZoom]);

	const handleResizeEnd = useCallback(() => {
		setResizingTrack(null);
	}, []);

	// Attach global mouse events for resizing
	useEffect(() => {
		if (resizingTrack) {
			document.addEventListener('mousemove', handleResizeMove);
			document.addEventListener('mouseup', handleResizeEnd);
			document.body.style.cursor = 'ns-resize';
		}
		
		return () => {
			document.removeEventListener('mousemove', handleResizeMove);
			document.removeEventListener('mouseup', handleResizeEnd);
			document.body.style.cursor = '';
		};
	}, [resizingTrack, handleResizeMove, handleResizeEnd]);

	return (
		<div className="w-full">
			{/* Track List */}
			<div>
				{tracks.map((track) => {
					const trackHeight = Math.round(DAW_HEIGHTS.TRACK_ROW * trackHeightZoom);
					
					return (
					<div
						key={track.id}
						className={`w-full transition-colors ${DAW_COLORS.BORDER_DEFAULT} border-b ${
							selectedTrackId === track.id
								? DAW_COLORS.SELECTED_BG
								: `bg-background hover:${DAW_COLORS.HOVER_BG}`
						} relative`}
						style={{
							height: trackHeight,
							padding: `${DAW_SPACING.TRACK_PADDING}px`,
							display: "flex",
							flexDirection: "column",
							justifyContent: "space-between",
						}}
					>
						{/* Track Header */}
						<div className="flex items-center justify-between">
							<button
								type="button"
								className={`flex items-center gap-2 flex-1 min-w-0 cursor-pointer ${DAW_BUTTONS.TRANSPARENT} text-left`}
								onClick={() => setSelectedTrackId(track.id)}
								onDoubleClick={() => setEditingTrackId(track.id)}
							>
								<div
									className={`${DAW_ICONS.XS} rounded-full flex-shrink-0`}
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
									<span className={`${DAW_TEXT.TRACK_NAME} select-none`}>
										{track.name}
									</span>
								)}
							</button>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0 flex-shrink-0 opacity-60 hover:opacity-100"
									>
										<MoreVertical className={DAW_ICONS.XS} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => setEditingTrackId(track.id)}>
										<Edit3 className={`${DAW_ICONS.MD} mr-2`} />
										Rename
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => removeTrack(track.id)}
										className="text-destructive"
									>
										<Trash2 className={`${DAW_ICONS.MD} mr-2`} />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>

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
								className="h-7 w-7 p-0 flex-shrink-0"
								onClick={(e) => {
									e.stopPropagation();
									toggleMute(track.id, track.muted);
								}}
							>
								{track.muted ? (
									<VolumeX className={DAW_ICONS.XS} />
								) : (
									<Volume2 className={DAW_ICONS.XS} />
								)}
							</Button>

							<Button
								variant={track.soloed ? "default" : "ghost"}
								size="sm"
								className="h-7 w-7 p-0 flex-shrink-0"
								onClick={(e) => {
									e.stopPropagation();
									toggleSolo(track.id, track.soloed);
								}}
							>
								<Headphones className={DAW_ICONS.XS} />
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

						{/* Resize Handle - adjusts global zoom */}
						<div
							className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/50 opacity-0 hover:opacity-100 transition-opacity"
							onMouseDown={handleResizeStart}
							title="Resize all tracks height"
						>
							<div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-border rounded-t">
								<GripHorizontal className="w-3 h-3 mx-auto -mt-1 text-muted-foreground" />
							</div>
						</div>
					</div>
					);
				})}

				{tracks.length === 0 && (
					<div className="text-center py-8 text-muted-foreground px-4">
						<p className="text-sm">
							No tracks yet. Use the + button above to add tracks.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
