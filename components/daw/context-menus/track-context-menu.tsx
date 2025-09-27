"use client";

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
	formatDb,
	VOLUME_MAX_DB,
	VOLUME_MIN_DB,
	volumeToDb,
} from "@/lib/audio/volume";

type TrackContextMenuProps = {
	trackId: string;
	trackName: string;
	isMuted: boolean;
	isSoloed: boolean;
	volume: number;
	onRequestRename?: () => void;
	onToggleSolo: () => void;
	onToggleMute: () => void;
	onResetVolume: () => void;
	onMuteHard: () => void;
	onSetVolumeDb: (db: number) => void;
	onDeleteTrack: () => void;
	onSelectTrack: () => void;
	children: React.ReactNode;
};

export function TrackContextMenu({
	trackId,
	trackName,
	isMuted,
	isSoloed,
	volume,
	onRequestRename,
	onToggleSolo,
	onToggleMute,
	onResetVolume,
	onMuteHard,
	onSetVolumeDb,
	onDeleteTrack,
	onSelectTrack,
	children,
}: TrackContextMenuProps) {
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

	const handleVolumeCommit = (dbValue: number) => {
		if (!Number.isFinite(dbValue)) {
			onMuteHard();
			return;
		}
		const clamped = clampDb(dbValue);
		onSetVolumeDb(clamped);
	};

	const handleRename = () => {
		setMenuOpen(false);
		onRequestRename?.();
	};

	const liveDb = volumeDbInput.length > 0 ? Number(volumeDbInput) : displayDb;

	return (
		<ContextMenu
			onOpenChange={(open) => {
				setMenuOpen(open);
				if (open) {
					onSelectTrack();
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
				<ContextMenuItem onClick={onToggleSolo}>
					{isSoloed ? "Unsolo" : "Solo"}
				</ContextMenuItem>
				<ContextMenuItem onClick={onToggleMute}>
					{isMuted ? "Unmute" : "Mute"}
				</ContextMenuItem>
				<ContextMenuItem onClick={() => {
					onResetVolume();
					setVolumeDbInput("0");
				}}>
					Reset to 0 dB
				</ContextMenuItem>
				<ContextMenuItem onClick={() => {
					onMuteHard();
					setVolumeDbInput(String(VOLUME_MIN_DB));
				}}>
					Mute (−∞ dB)
				</ContextMenuItem>
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
							onClick={() => {
								onResetVolume();
								setVolumeDbInput("0");
							}}
						>
							0 dB
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								onMuteHard();
								setVolumeDbInput(String(VOLUME_MIN_DB));
							}}
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
				<ContextMenuItem onClick={onDeleteTrack} variant="destructive">
					Delete Track
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
