"use client";

import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import {
	clampDb,
	dbToVolume,
	formatDb,
	VOLUME_MAX_DB,
	VOLUME_MIN_DB,
	volumeToDb,
} from "@/lib/audio/volume";
import {
	removeTrackAtom,
	selectedTrackIdAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";

type TrackContextMenuProps = {
	trackId: string;
	trackName: string;
	isMuted: boolean;
	isSoloed: boolean;
	volume: number;
	onRequestRename?: () => void;
	children: React.ReactNode;
};

export function TrackContextMenu({
	trackId,
	trackName,
	isMuted,
	isSoloed,
	volume,
	onRequestRename,
	children,
}: TrackContextMenuProps) {
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [, removeTrack] = useAtom(removeTrackAtom);
	const [, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [menuOpen, setMenuOpen] = useState(false);
	const [volumeDbInput, setVolumeDbInput] = useState<string>("");

	const computedDb = useMemo(() => {
		if (volume <= 0) return Number.NEGATIVE_INFINITY;
		const db = volumeToDb(volume);
		return clampDb(Number.isFinite(db) ? db : VOLUME_MIN_DB);
	}, [volume]);

	const displayDb =
		computedDb === Number.NEGATIVE_INFINITY ? VOLUME_MIN_DB : computedDb;

	useEffect(() => {
		if (menuOpen) {
			setVolumeDbInput(volume <= 0 ? "" : String(displayDb));
		} else {
			setVolumeDbInput("");
		}
	}, [menuOpen, volume, displayDb]);

	const handleMuteHard = () => {
		updateTrack(trackId, { volume: 0, muted: true });
	};

	const handleVolumeCommit = (dbValue: number) => {
		if (!Number.isFinite(dbValue)) {
			handleMuteHard();
			return;
		}
		const clamped = clampDb(dbValue);
		const volumeValue = dbToVolume(clamped);
		updateTrack(trackId, { volume: volumeValue, muted: volumeValue <= 0 });
	};

	const handleRename = () => {
		setMenuOpen(false);
		onRequestRename?.();
	};

	const handleSoloToggle = () => {
		updateTrack(trackId, { soloed: !isSoloed });
	};

	const handleMuteToggle = () => {
		if (isMuted) {
			updateTrack(trackId, { muted: false });
			return;
		}
		updateTrack(trackId, { muted: true });
	};

	const handleDelete = () => {
		removeTrack(trackId);
	};

	const liveDb = volumeDbInput.length > 0 ? Number(volumeDbInput) : displayDb;

	return (
		<ContextMenu
			onOpenChange={(open) => {
				setMenuOpen(open);
				if (open) {
					setSelectedTrackId(trackId);
				}
			}}
		>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-64" alignOffset={-4}>
				<div className="px-2 py-1.5 text-xs text-muted-foreground">
					Track
					<span className="ml-1 text-foreground">{trackName}</span>
				</div>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={handleRename}>Rename</ContextMenuItem>
				<ContextMenuItem onClick={handleSoloToggle}>
					{isSoloed ? "Unsolo" : "Solo"}
				</ContextMenuItem>
				<ContextMenuItem onClick={handleMuteToggle}>
					{isMuted ? "Unmute" : "Mute"}
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleVolumeCommit(0)}>
					Reset to 0 dB
				</ContextMenuItem>
				<ContextMenuItem onClick={handleMuteHard}>Mute (−∞ dB)</ContextMenuItem>
				<ContextMenuSeparator />
				<div className="px-2 pb-2">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>Volume (dB)</span>
						<span className="font-medium text-foreground">
							{volume <= 0 || isMuted ? "Muted" : formatDb(liveDb)}
						</span>
					</div>
					<div className="mt-2 flex items-center gap-2">
						<Input
							type="number"
							inputMode="decimal"
							step={0.5}
							min={VOLUME_MIN_DB}
							max={VOLUME_MAX_DB}
							value={volumeDbInput}
							placeholder={volume <= 0 || isMuted ? "Muted" : String(displayDb)}
							onChange={(event) => {
								setVolumeDbInput(event.target.value);
							}}
							onBlur={() => {
								if (!volumeDbInput.trim()) return;
								const parsed = Number(volumeDbInput);
								if (Number.isFinite(parsed)) {
									handleVolumeCommit(parsed);
								}
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.currentTarget.blur();
								}
							}}
							className="h-8"
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => handleVolumeCommit(0)}
						>
							0 dB
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleMuteHard}
						>
							Mute
						</Button>
					</div>
					<input
						type="range"
						min={VOLUME_MIN_DB}
						max={VOLUME_MAX_DB}
						step={0.5}
						value={
							volume <= 0 || isMuted
								? VOLUME_MIN_DB
								: volumeDbInput.trim().length > 0
									? Number(volumeDbInput)
									: displayDb
						}
						onChange={(event) => {
							const next = Number(event.target.value);
							setVolumeDbInput(String(next));
							handleVolumeCommit(next);
						}}
						className="mt-3 h-1 w-full cursor-pointer appearance-none rounded bg-muted"
					/>
				</div>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={handleDelete} variant="destructive">
					Delete Track
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
