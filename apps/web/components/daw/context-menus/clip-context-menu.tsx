"use client";

import { useAtom } from "jotai";
import { useState } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import {
	automationViewEnabledAtom,
	clipInspectorOpenAtom,
	clipInspectorTargetAtom,
	removeClipAtom,
	renameClipAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
} from "@/lib/daw-sdk";

type ClipContextMenuProps = {
	trackId: string;
	clipId: string;
	clipName: string;
	onRequestRename?: () => void;
	children: React.ReactNode;
};

export function ClipContextMenu({
	trackId,
	clipId,
	clipName,
	onRequestRename,
	children,
}: ClipContextMenuProps) {
	const [, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [, setSelectedClipId] = useAtom(selectedClipIdAtom);
	const [, renameClip] = useAtom(renameClipAtom);
	const [, removeClip] = useAtom(removeClipAtom);
	const [, setInspectorOpen] = useAtom(clipInspectorOpenAtom);
	const [, setInspectorTarget] = useAtom(clipInspectorTargetAtom);
	const [automationView, setAutomationView] = useAtom(
		automationViewEnabledAtom,
	);
	const [editing, setEditing] = useState(false);
	const [draftName, setDraftName] = useState(clipName);
	const [_showPropertiesDialog, setShowPropertiesDialog] = useState(false);

	const commitRename = async () => {
		const next = draftName.trim();
		if (!next || next === clipName) {
			setEditing(false);
			return;
		}
		await renameClip(trackId, clipId, next);
		setEditing(false);
	};

	return (
		<ContextMenu
			onOpenChange={(open) => {
				setEditing(false);
				setDraftName(clipName);
				if (open) {
					setSelectedTrackId(trackId);
					setSelectedClipId(clipId);
				}
			}}
		>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-56" alignOffset={-4}>
				{editing ? (
					<div className="px-2 py-1.5">
						<Input
							value={draftName}
							autoFocus
							placeholder="Clip name"
							onChange={(event) => setDraftName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									commitRename();
								}
								if (event.key === "Escape") {
									setEditing(false);
								}
							}}
							onBlur={commitRename}
							className="h-8"
						/>
					</div>
				) : (
					<ContextMenuItem
						onClick={() => {
							setEditing(true);
							onRequestRename?.();
						}}
					>
						Rename
					</ContextMenuItem>
				)}
				<ContextMenuSeparator />
				<ContextMenuItem
					onClick={() => {
						setInspectorTarget({ trackId, clipId });
						setInspectorOpen(true);
					}}
				>
					Edit
				</ContextMenuItem>
				<ContextMenuItem
					onClick={() => {
						setAutomationView(!automationView);
					}}
				>
					{automationView ? "Hide Automation" : "Show Automation"}
				</ContextMenuItem>
				<ContextMenuItem
					onClick={() => {
						setShowPropertiesDialog(true);
					}}
				>
					Properties
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem
					onClick={() => removeClip(trackId, clipId)}
					variant="destructive"
				>
					Delete Clip
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
