"use client";

import { useAtom } from "jotai";
import {
	Download,
	FolderOpen,
	MoreHorizontal,
	Save,
	Settings,
	Upload,
	HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { DAW_HEIGHTS, DAW_ICONS, DAW_TEXT } from "@/lib/constants/daw-design";
import { projectNameAtom, tracksAtom } from "@/lib/state/daw-store";

export function DAWToolbar() {
	const [projectName, setProjectName] = useAtom(projectNameAtom);
	const [tracks] = useAtom(tracksAtom);

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
				<Button variant="ghost" size="sm" onClick={handleImportAudio}>
					<Upload className={DAW_ICONS.MD} />
					<span className="ml-1 text-xs">Import</span>
				</Button>

				<Button variant="ghost" size="sm" onClick={handleExportProject}>
					<Download className={DAW_ICONS.MD} />
					<span className="ml-1 text-xs">Export</span>
				</Button>

				<Dialog>
					<DialogTrigger asChild>
						<Button variant="ghost" size="sm" aria-label="Keyboard shortcuts">
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
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
							<div>
								<b>Space</b>: Play/Pause
							</div>
							<div>
								<b>S</b>: Stop
							</div>
							<div>
								<b>L</b>: Toggle loop for selected clip
							</div>
							<div>
								<b>M</b>/<b>Solo</b>: Mute/Solo track
							</div>
							<div>
								<b>←/→</b>: Move project end by grid
							</div>
							<div>
								<b>Shift+←/→</b>: ×4 step
							</div>
							<div>
								<b>Home</b>: Project end to 0
							</div>
							<div>
								<b>End</b>: Project end to media end
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
