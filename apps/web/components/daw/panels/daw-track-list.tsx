"use client";

import {
	automationViewEnabledAtom,
	isPlayingAtom,
	removeTrackAtom,
	selectedTrackIdAtom,
	serviceRegistry,
	setTrackHeightZoomAtom,
	trackAutomationTypeAtom,
	trackHeightZoomAtom,
	tracksAtom,
	updateTrackAtom,
} from "@wav0/daw-react";
import type { AutomationType, Track } from "@wav0/daw-sdk";
import { volume } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { GripHorizontal, MoreVertical, Volume2, VolumeX } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import {
	TrackContextMenu,
	TrackMenuOptions,
} from "@/components/daw/context-menus/track-context-menu";
import { LiveAutomationBadge } from "@/components/daw/controls/live-automation-badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DAW_BUTTONS,
	DAW_COLORS,
	DAW_HEIGHTS,
	DAW_ICONS,
	DAW_SPACING,
	DAW_TEXT,
} from "@/lib/constants/daw-design";
import { cn } from "@/lib/utils";

// ===== Memoized Track List Row Component =====
type TrackListRowProps = {
	track: Track;
	trackHeight: number;
	isSelected: boolean;
	isEditing: boolean;
	editingName: string;
	isPlaying: boolean;
	automationViewEnabled: boolean;
	automationType: AutomationType;
	onSelect: (trackId: string) => void;
	onStartEdit: (trackId: string, name: string) => void;
	onFinishEdit: (trackId: string) => void;
	onCancelEdit: () => void;
	onEditNameChange: (name: string) => void;
	onToggleMute: (trackId: string, muted: boolean) => void;
	onToggleSolo: (trackId: string, soloed: boolean) => void;
	onVolumeChange: (trackId: string, volume: number) => void;
	onSetVolumeDb: (trackId: string, db: number) => void;
	onResetVolume: (trackId: string) => void;
	onDeleteTrack: (trackId: string) => void;
	onAutomationTypeChange: (trackId: string, type: AutomationType) => void;
	onResizeStart: (e: React.MouseEvent) => void;
};

const TrackListRow = memo(function TrackListRow({
	track,
	trackHeight,
	isSelected,
	isEditing,
	editingName,
	isPlaying,
	automationViewEnabled,
	automationType,
	onSelect,
	onStartEdit,
	onFinishEdit,
	onCancelEdit,
	onEditNameChange,
	onToggleMute,
	onToggleSolo,
	onVolumeChange,
	onSetVolumeDb,
	onResetVolume,
	onDeleteTrack,
	onAutomationTypeChange,
	onResizeStart,
}: TrackListRowProps) {
	const trackVolume = track.volume ?? 75;
	const dbValue = volume.volumeToDb(trackVolume);
	const volumeLabel =
		trackVolume <= 0 || track.muted ? "Muted" : volume.formatDb(dbValue);

	// Handlers - compiler handles memoization
	const handleSelect = () => onSelect(track.id);
	const handleStartEdit = () => onStartEdit(track.id, track.name);
	const handleFinishEdit = () => onFinishEdit(track.id);
	const handleToggleMute = () => onToggleMute(track.id, track.muted);
	const handleToggleSolo = () => onToggleSolo(track.id, track.soloed);
	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) =>
		onVolumeChange(track.id, Number.parseInt(e.target.value, 10));
	const handleSetVolumeDb = (db: number) => onSetVolumeDb(track.id, db);
	const handleResetVolume = () => onResetVolume(track.id);
	const handleDeleteTrack = () => onDeleteTrack(track.id);
	const handleRequestRename = () => onStartEdit(track.id, track.name);
	const handleAutomationTypeChange = (value: AutomationType) =>
		onAutomationTypeChange(track.id, value);

	return (
		<TrackContextMenu
			trackName={track.name}
			isMuted={track.muted}
			isSoloed={track.soloed}
			currentDb={dbValue}
			onRequestRename={handleRequestRename}
			onToggleSolo={handleToggleSolo}
			onToggleMute={handleToggleMute}
			onResetVolume={handleResetVolume}
			onSetVolumeDb={handleSetVolumeDb}
			onDeleteTrack={handleDeleteTrack}
			onSelectTrack={handleSelect}
		>
			<div
				className={`w-full transition-colors ${DAW_COLORS.BORDER_DEFAULT} border-b ${
					isSelected
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
						onClick={handleSelect}
						onDoubleClick={handleStartEdit}
					>
						<div
							className={`${DAW_ICONS.XS} rounded-full shrink-0`}
							style={{ backgroundColor: track.color }}
						/>
						{isEditing ? (
							<input
								value={editingName}
								onChange={(e) => onEditNameChange(e.target.value)}
								onBlur={handleFinishEdit}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleFinishEdit();
									} else if (e.key === "Escape") {
										onCancelEdit();
									}
								}}
								className="h-6 text-sm px-1 border border-primary rounded"
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
							<Button variant="ghost" size="icon" className="h-7 w-7">
								<MoreVertical className={DAW_ICONS.XS} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-64">
							<TrackMenuOptions
								trackName={track.name}
								isMuted={track.muted}
								isSoloed={track.soloed}
								currentDb={dbValue}
								onRequestRename={handleRequestRename}
								onToggleSolo={handleToggleSolo}
								onToggleMute={handleToggleMute}
								onResetVolume={handleResetVolume}
								onSetVolumeDb={handleSetVolumeDb}
								onDeleteTrack={handleDeleteTrack}
								MenuItem={({ children, ...props }) => (
									<DropdownMenuItem {...props}>{children}</DropdownMenuItem>
								)}
								MenuSeparator={(props) => <DropdownMenuSeparator {...props} />}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Track Controls - Redesigned for breathing room */}
				<div className="mt-2 flex items-center gap-3">
					<Button
						variant={track.muted ? "default" : "ghost"}
						size="sm"
						className="h-7 w-7 p-0 shrink-0"
						onClick={(e) => {
							e.stopPropagation();
							handleToggleMute();
						}}
					>
						{track.muted ? (
							<VolumeX className={DAW_ICONS.XS} />
						) : (
							<Volume2 className={DAW_ICONS.XS} />
						)}
					</Button>

					<button
						type="button"
						className={cn(
							"h-7 w-7 rounded-sm text-xs font-semibold transition-colors",
							track.soloed
								? "bg-amber-400 text-black"
								: "bg-muted/40 text-muted-foreground hover:bg-muted/70",
						)}
						onClick={(e) => {
							e.stopPropagation();
							handleToggleSolo();
						}}
						aria-pressed={track.soloed}
						aria-label={track.soloed ? "Unsolo track" : "Solo track"}
					>
						S
					</button>

					{/* Automation Type Selector - Only show when automation view enabled */}
					{automationViewEnabled && (
						<Select
							value={automationType}
							onValueChange={handleAutomationTypeChange}
						>
							<SelectTrigger
								className="h-7 w-20 text-xs"
								aria-label="Automation type"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="volume">Vol</SelectItem>
								<SelectItem value="pan" disabled>
									Pan
								</SelectItem>
							</SelectContent>
						</Select>
					)}

					{/* Volume Controls - More spacious layout */}
					<div className="flex flex-1 items-center gap-2">
						<div className="flex-1 min-w-0">
							<input
								type="range"
								min={0}
								max={100}
								value={track.volume}
								onChange={handleVolumeChange}
								onClick={(e) => e.stopPropagation()}
								className="w-full h-1.5 cursor-pointer appearance-none rounded-lg bg-muted hover:bg-muted/80 transition-colors"
								title={
									track.volumeEnvelope?.enabled
										? `Base volume: ${volumeLabel} (envelope active)`
										: `Volume: ${volumeLabel}`
								}
							/>
						</div>

						<div className="flex items-center gap-1.5 min-w-[80px]">
							<span
								className="text-xs font-mono text-muted-foreground tabular-nums"
								title={
									track.volumeEnvelope?.enabled ? "Base level" : "Track volume"
								}
							>
								{volumeLabel}
							</span>
							{track.volumeEnvelope?.enabled && (
				<LiveAutomationBadge
					envelope={track.volumeEnvelope}
					baseVolume={track.volume ?? 75}
					isPlaying={isPlaying}
				/>
							)}
						</div>
					</div>
				</div>

				{/* Resize Handle - adjusts global zoom */}
				<button
					type="button"
					className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/50 opacity-0 hover:opacity-100 transition-opacity"
					onMouseDown={onResizeStart}
					title="Resize all tracks height"
					aria-label="Resize all tracks height"
				>
					<div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-border rounded-t">
						<GripHorizontal className="w-3 h-3 mx-auto -mt-1 text-muted-foreground" />
					</div>
				</button>
			</div>
		</TrackContextMenu>
	);
});

// ===== Main DAWTrackList Component =====
export function DAWTrackList() {
	const [tracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [, setTrackHeightZoom] = useAtom(setTrackHeightZoomAtom);
	const [, removeTrack] = useAtom(removeTrackAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [automationViewEnabled] = useAtom(automationViewEnabledAtom);
	const [trackAutomationTypes, setTrackAutomationTypes] = useAtom(
		trackAutomationTypeAtom,
	);
	// Use isPlayingAtom instead of playbackAtom to avoid re-renders on currentTime changes
	const [isPlaying] = useAtom(isPlayingAtom);
	// Ref to read isPlaying in callbacks without adding to deps (prevents callback recreation on play/pause)
	const isPlayingRef = useRef(isPlaying);
	useEffect(() => {
		isPlayingRef.current = isPlaying;
	}, [isPlaying]);

	const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
	const [editingTrackName, setEditingTrackName] = useState<string>("");
	const [resizingTrack, setResizingTrack] = useState<{
		startY: number;
		startZoom: number;
	} | null>(null);

	// Compute track height once
	const trackHeight = Math.round(DAW_HEIGHTS.TRACK_ROW * trackHeightZoom);

	// Handlers - compiler handles memoization
	const handleSelect = (trackId: string) => setSelectedTrackId(trackId);

	const handleStartEdit = (trackId: string, name: string) => {
		setEditingTrackId(trackId);
		setEditingTrackName(name);
	};

	const handleFinishEdit = (trackId: string) => {
		if (editingTrackName.trim()) {
			updateTrack(trackId, { name: editingTrackName.trim() });
		}
		setEditingTrackId(null);
		setEditingTrackName("");
	};

	const handleCancelEdit = () => {
		setEditingTrackId(null);
		setEditingTrackName("");
	};

	const handleEditNameChange = (name: string) => setEditingTrackName(name);

	const handleToggleMute = (trackId: string, _currentMuted: boolean) =>
		updateTrack(trackId, { muted: !_currentMuted });

	const handleToggleSolo = (trackId: string, currentSoloed: boolean) =>
		updateTrack(trackId, { soloed: !currentSoloed });

	const handleVolumeChange = (trackId: string, volumePercent: number) => {
		const volumeDb = volume.volumeToDb(volumePercent);
		updateTrack(trackId, { volume: volumePercent, volumeDb });
		if (isPlayingRef.current && serviceRegistry.playbackService) {
			serviceRegistry.playbackService.updateTrackVolumeRealtime(trackId, volumeDb);
		}
	};

	const handleSetVolumeDb = (trackId: string, db: number) => {
		const volumeValue = volume.dbToVolume(db);
		updateTrack(trackId, { volume: volumeValue, muted: volumeValue <= 0 });
	};

	const handleResetVolume = (trackId: string) => {
		const volumeValue = volume.dbToVolume(0);
		updateTrack(trackId, { volume: volumeValue });
	};

	const handleDeleteTrack = (trackId: string) => removeTrack(trackId);

	const handleAutomationTypeChange = (trackId: string, type: AutomationType) => {
		const newMap = new Map(trackAutomationTypes);
		newMap.set(trackId, type);
		setTrackAutomationTypes(newMap);
	};

	const handleResizeStart = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setResizingTrack({ startY: e.clientY, startZoom: trackHeightZoom });
	};

	const handleResizeMove = (e: MouseEvent) => {
		if (!resizingTrack) return;
		const deltaY = e.clientY - resizingTrack.startY;
		const deltaZoom = deltaY / DAW_HEIGHTS.TRACK_ROW;
		const newZoom = resizingTrack.startZoom + deltaZoom;
		setTrackHeightZoom(newZoom);
	};

	const handleResizeEnd = () => setResizingTrack(null);

	// Attach global mouse events for resizing
	useEffect(() => {
		if (resizingTrack) {
			document.addEventListener("mousemove", handleResizeMove);
			document.addEventListener("mouseup", handleResizeEnd);
			document.body.style.cursor = "ns-resize";
		}

		return () => {
			document.removeEventListener("mousemove", handleResizeMove);
			document.removeEventListener("mouseup", handleResizeEnd);
			document.body.style.cursor = "";
		};
	}, [resizingTrack, handleResizeMove, handleResizeEnd]);

	return (
		<div className="w-full">
			{/* Track List */}
			<div>
				{tracks.map((track) => (
					<TrackListRow
						key={track.id}
						track={track}
						trackHeight={trackHeight}
						isSelected={selectedTrackId === track.id}
						isEditing={editingTrackId === track.id}
						editingName={editingTrackName}
						isPlaying={isPlaying}
						automationViewEnabled={automationViewEnabled}
						automationType={trackAutomationTypes.get(track.id) || "volume"}
						onSelect={handleSelect}
						onStartEdit={handleStartEdit}
						onFinishEdit={handleFinishEdit}
						onCancelEdit={handleCancelEdit}
						onEditNameChange={handleEditNameChange}
						onToggleMute={handleToggleMute}
						onToggleSolo={handleToggleSolo}
						onVolumeChange={handleVolumeChange}
						onSetVolumeDb={handleSetVolumeDb}
						onResetVolume={handleResetVolume}
						onDeleteTrack={handleDeleteTrack}
						onAutomationTypeChange={handleAutomationTypeChange}
						onResizeStart={handleResizeStart}
					/>
				))}

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
