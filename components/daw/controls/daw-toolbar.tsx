"use client";

import { useAtom } from "jotai";
import {
	Download,
	FolderOpen,
	HelpCircle,
	List,
	MoreHorizontal,
	Save,
	Settings,
	Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DAW_HEIGHTS, DAW_ICONS, DAW_TEXT } from "@/lib/constants/daw-design";
import { eventListOpenAtom, projectNameAtom, tracksAtom } from "@/lib/state/daw-store";

export function DAWToolbar() {
	const [projectName, setProjectName] = useAtom(projectNameAtom);
	const [tracks] = useAtom(tracksAtom);
	const [, setEventListOpen] = useAtom(eventListOpenAtom);

	const handleImportAudio = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "audio/*";
		input.multiple = true;
		input.onchange = async (e) => {
			const files = (e.target as HTMLInputElement).files;
			if (!files) return;

			// Handle file import logic here
			console.log("Importing files:", files);
		};
		input.click();
	};

	const handleExportProject = async () => {
		// Basic project export
		const projectData = {
			name: projectName,
			tracks: tracks,
			timestamp: new Date().toISOString(),
		};

		const blob = new Blob([JSON.stringify(projectData, null, 2)], {
			type: "application/json",
		});

		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${projectName}.wav0`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div
			className="bg-background border-b flex items-center justify-between px-4"
			style={{ height: DAW_HEIGHTS.TOOLBAR }}
		>
			<div className="flex items-center gap-4">
				<h1 className={DAW_TEXT.BRAND}>
					wav<span className="text-muted-foreground">0</span>
				</h1>

				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" onClick={() => {}}>
						<FolderOpen className={DAW_ICONS.MD} />
					</Button>
					<Button variant="ghost" size="sm" onClick={() => {}}>
						<Save className={DAW_ICONS.MD} />
					</Button>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<Input
					value={projectName}
					onChange={(e) => setProjectName(e.target.value)}
					className="w-48 text-sm"
					style={{ height: DAW_HEIGHTS.BUTTON_MD }}
					placeholder="Project name"
				/>
			</div>

			<div className="flex items-center gap-2">
				<Button 
					variant="ghost" 
					size="sm" 
					onClick={() => setEventListOpen(true)}
					title="Event List (E)"
				>
					<List className={DAW_ICONS.MD} />
					<span className="ml-1 text-xs">Events</span>
				</Button>

				<Button variant="ghost" size="sm" onClick={handleImportAudio}>
					<Upload className={DAW_ICONS.MD} />
					<span className="ml-1 text-xs">Import</span>
				</Button>

				<Button variant="ghost" size="sm" onClick={handleExportProject}>
					<Download className={DAW_ICONS.MD} />
					<span className="ml-1 text-xs">Export</span>
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						// Use global shortcut path already wired; duplicate here for discoverability
						const event = new KeyboardEvent("keydown", {
							key: "S",
							shiftKey: true,
						});
						window.dispatchEvent(event);
					}}
					title="Split at playhead (Shift+S)"
				>
					<span className="ml-1 text-xs">Split</span>
				</Button>

				<Dialog>
					<DialogTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							aria-label="Keyboard shortcuts"
							onClick={(e) => e.stopPropagation()}
						>
							<HelpCircle className={DAW_ICONS.MD} />
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-xl">
						<DialogHeader>
							<DialogTitle>Keyboard shortcuts</DialogTitle>
							<DialogDescription>
								Quick controls to keep you in flow
							</DialogDescription>
						</DialogHeader>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm leading-6">
							<div>
								<b>Space</b>: Play/Pause
							</div>
							<div>
								<b>S</b>: Restart from 0
							</div>
							<div>
								<b>Shift+S</b>: Split at playhead
							</div>
							<div>
								<b>L</b>: Loop toggle; [ / ] prev/next clip; Alt+L set loop end;
								Shift+L clear
							</div>
							<div>
								<b>M</b>/<b>Shift+M</b>: Mute/Solo track; <b>1–9</b>: Select
								track
							</div>
							<div>
								<b>←/→</b>: Seek by grid
							</div>
							<div>
								<b>Shift+←/→</b>: Project end by grid
							</div>
							<div>
								<b>Cmd+←/→</b>: Seek to start/end (Mac)
							</div>
							<div>
								<b>/</b> or <b>?</b>: Open this dialog
							</div>
						</div>
					</DialogContent>
				</Dialog>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm">
							<MoreHorizontal className={DAW_ICONS.MD} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>
							<Settings className={`${DAW_ICONS.MD} mr-2`} />
							Settings
						</DropdownMenuItem>
						<DropdownMenuItem>Clear Project</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
