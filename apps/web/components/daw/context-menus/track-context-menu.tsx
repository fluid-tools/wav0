"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { volume } from "@wav0/daw-sdk";

const VOLUME_MIN_DB = -60;
const VOLUME_MAX_DB = 12;
const clampDb = (db: number) => Math.max(VOLUME_MIN_DB, Math.min(VOLUME_MAX_DB, db));

type TrackMenuHandlers = {
	onRequestRename?: () => void;
	onToggleSolo: () => void;
	onToggleMute: () => void;
	onResetVolume: () => void;
	onSetVolumeDb: (db: number) => void;
	onDeleteTrack: () => void;
};

type TrackMenuSharedProps = TrackMenuHandlers & {
	trackName: string;
	isMuted: boolean;
	isSoloed: boolean;
	currentDb: number;
};

type TrackContextMenuProps = TrackMenuSharedProps & {
	onSelectTrack: () => void;
	children: React.ReactNode;
};

type MenuItemComponent = React.ComponentType<{
	onClick?: () => void;
	className?: string;
	children: React.ReactNode;
}>;

type MenuSeparatorComponent = React.ComponentType<{ className?: string }>;

type TrackMenuOptionsProps = TrackMenuSharedProps & {
	MenuItem: MenuItemComponent;
	MenuSeparator: MenuSeparatorComponent;
};

function formatDbForInput(value: number) {
	return Number.isFinite(value) ? Number(value.toFixed(1)) : "";
}

export function TrackMenuOptions({
	trackName,
	isMuted,
	isSoloed,
	currentDb,
	onRequestRename,
	onToggleSolo,
	onToggleMute,
	onResetVolume,
	onSetVolumeDb,
	onDeleteTrack,
	MenuItem,
	MenuSeparator,
}: TrackMenuOptionsProps) {
	const [dbInput, setDbInput] = useState<string>("");

	const effectiveDb = Number.isFinite(currentDb)
		? clampDb(currentDb)
		: VOLUME_MIN_DB;

	useEffect(() => {
		const next = formatDbForInput(currentDb);
		setDbInput(next === "" ? "" : String(next));
	}, [currentDb]);

	const handleCommit = (value: string) => {
		if (!value.trim()) return;
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return;
		const clamped = clampDb(parsed);
		onSetVolumeDb(clamped);
		setDbInput(String(formatDbForInput(clamped)));
	};

	return (
		<>
			<div className="px-2 py-1.5 text-xs text-muted-foreground">
				Track
				<span className="ml-1 text-foreground">{trackName}</span>
			</div>
			<MenuSeparator />
			<MenuItem onClick={onRequestRename}>Rename</MenuItem>
			<MenuItem onClick={onToggleSolo}>{isSoloed ? "Unsolo" : "Solo"}</MenuItem>
			<MenuItem onClick={onToggleMute}>{isMuted ? "Unmute" : "Mute"}</MenuItem>
			<MenuSeparator />
			<div className="px-2 pb-2">
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>Volume (dB)</span>
					<span className="font-medium text-foreground">
						{isMuted || !Number.isFinite(currentDb)
						? "Muted"
						: volume.formatDb(currentDb)}
					</span>
				</div>
				<div className="mt-2 flex items-center gap-2">
					<Input
						type="number"
						inputMode="decimal"
						step={0.5}
						min={VOLUME_MIN_DB}
						max={VOLUME_MAX_DB}
						value={dbInput}
						placeholder={
							isMuted || !Number.isFinite(currentDb)
								? "Muted"
								: String(formatDbForInput(currentDb))
						}
						onChange={(event) => setDbInput(event.target.value)}
						onBlur={(event) => handleCommit(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								handleCommit((event.target as HTMLInputElement).value);
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
							setDbInput(String(formatDbForInput(0)));
						}}
					>
						0 dB
					</Button>
				</div>
				<input
					type="range"
					min={VOLUME_MIN_DB}
					max={VOLUME_MAX_DB}
					step={0.5}
					value={
						isMuted || !Number.isFinite(currentDb) ? VOLUME_MIN_DB : effectiveDb
					}
					onChange={(event) => {
						const next = Number(event.target.value);
						setDbInput(String(formatDbForInput(next)));
						onSetVolumeDb(next);
					}}
					className="mt-3 h-1 w-full cursor-pointer appearance-none rounded bg-muted"
				/>
			</div>
			<MenuSeparator />
			<MenuItem onClick={onDeleteTrack} className="text-destructive">
				Delete Track
			</MenuItem>
		</>
	);
}

export function TrackContextMenu({
	trackName,
	isMuted,
	isSoloed,
	currentDb,
	onRequestRename,
	onToggleSolo,
	onToggleMute,
	onResetVolume,
	onSetVolumeDb,
	onDeleteTrack,
	onSelectTrack,
	children,
}: TrackContextMenuProps) {
	const [_menuOpen, setMenuOpen] = useState(false);

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
				<TrackMenuOptions
					trackName={trackName}
					isMuted={isMuted}
					isSoloed={isSoloed}
					currentDb={currentDb}
					onRequestRename={onRequestRename}
					onToggleSolo={onToggleSolo}
					onToggleMute={onToggleMute}
					onResetVolume={onResetVolume}
					onSetVolumeDb={onSetVolumeDb}
					onDeleteTrack={onDeleteTrack}
					MenuItem={ContextMenuItem}
					MenuSeparator={ContextMenuSeparator}
				/>
			</ContextMenuContent>
		</ContextMenu>
	);
}
