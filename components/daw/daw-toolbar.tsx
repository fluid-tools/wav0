"use client";

import { useAtom } from "jotai";
import {
	Download,
	FolderOpen,
	MoreHorizontal,
	Save,
	Settings,
	Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
		<div className="h-12 bg-background border-b flex items-center justify-between px-4">
			<div className="flex items-center gap-4">
				<h1 className="text-sm font-mono uppercase tracking-tight font-bold">
					wav<span className="text-muted-foreground">0</span>
				</h1>

				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" onClick={() => {}}>
						<FolderOpen className="w-4 h-4" />
					</Button>
					<Button variant="ghost" size="sm" onClick={() => {}}>
						<Save className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<Input
					value={projectName}
					onChange={(e) => setProjectName(e.target.value)}
					className="w-48 h-8 text-sm"
					placeholder="Project name"
				/>
			</div>

			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" onClick={handleImportAudio}>
					<Upload className="w-4 h-4" />
					<span className="ml-1 text-xs">Import</span>
				</Button>

				<Button variant="ghost" size="sm" onClick={handleExportProject}>
					<Download className="w-4 h-4" />
					<span className="ml-1 text-xs">Export</span>
				</Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm">
							<MoreHorizontal className="w-4 h-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>
							<Settings className="w-4 h-4 mr-2" />
							Settings
						</DropdownMenuItem>
						<DropdownMenuItem>Clear Project</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
