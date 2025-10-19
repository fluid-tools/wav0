"use client";

import { useAtom } from "jotai";
// jotai imported elsewhere; remove duplicate import per linter
import {
	Activity,
	Download,
	FolderOpen,
	HelpCircle,
	List,
	MoreHorizontal,
	Save,
	Settings,
	Upload,
} from "lucide-react";
import { startTransition, useRef, useState } from "react";
import { ExportDialog } from "@/components/daw/dialogs/export-dialog";
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
import {
	automationViewEnabledAtom,
	eventListOpenAtom,
	gridAtom,
	musicalMetadataAtom,
	projectNameAtom,
} from "@/lib/daw-sdk";

export function DAWToolbar() {
	const [grid, setGrid] = useAtom(gridAtom);
	const [music, setMusic] = useAtom(musicalMetadataAtom);
	const [projectName, setProjectName] = useAtom(projectNameAtom);
	const [, setEventListOpen] = useAtom(eventListOpenAtom);
	const [automationViewEnabled, setAutomationViewEnabled] = useAtom(
		automationViewEnabledAtom,
	);
	const bpmDebounceRef = useRef<number | null>(null);

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

	const [exportOpen, setExportOpen] = useState(false);

	return (
		<>
			{/* Primary Toolbar */}
			<div
				className="bg-background border-b flex items-center justify-between px-4"
				style={{ height: DAW_HEIGHTS.TOOLBAR }}
			>
				<div className="flex items-center gap-4">
					<h1 className={DAW_TEXT.BRAND}>
						wav<span className="text-muted-foreground">0</span>
					</h1>

					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" disabled title="Coming soon" aria-label="Open project">
							<FolderOpen className={DAW_ICONS.MD} />
						</Button>
						<Button variant="ghost" size="sm" disabled title="Coming soon" aria-label="Save project">
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

					<Button
						variant={automationViewEnabled ? "default" : "ghost"}
						size="sm"
						onClick={() => setAutomationViewEnabled(!automationViewEnabled)}
						title="Toggle Automation View (A)"
						aria-label={
							automationViewEnabled
								? "Hide automation curves"
								: "Show automation curves"
						}
					>
						<Activity className={DAW_ICONS.MD} />
						<span className="ml-1 text-xs">Auto</span>
					</Button>

					<Button variant="ghost" size="sm" onClick={handleImportAudio}>
						<Upload className={DAW_ICONS.MD} />
						<span className="ml-1 text-xs">Import</span>
					</Button>

					<Button variant="ghost" size="sm" onClick={() => setExportOpen(true)}>
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
									<b>L</b>: Loop toggle; [ / ] prev/next clip; Alt+L set loop
									end; Shift+L clear
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
							<Button variant="ghost" size="sm" aria-label="More options">
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

			{/* Secondary Toolbar */}
			<div className="bg-muted/30 border-b flex items-center justify-between px-4 py-2">
				<div className="flex items-center gap-4">
					{/* Grid Group */}
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">Grid:</span>
						<Button
							variant={grid.mode === "time" ? "default" : "ghost"}
							size="sm"
							onClick={() =>
								startTransition(() => setGrid({ ...grid, mode: "time" }))
							}
						>
							Time
						</Button>
						<Button
							variant={grid.mode === "bars" ? "default" : "ghost"}
							size="sm"
							onClick={() =>
								startTransition(() => setGrid({ ...grid, mode: "bars" }))
							}
						>
							Bars
						</Button>
						<select
							className="text-xs border rounded px-1 py-1 ml-1"
							value={grid.resolution}
							onChange={(e) =>
								setGrid({
									...grid,
									resolution: e.target.value as typeof grid.resolution,
								})
							}
						>
							<option value="1/1">1/1</option>
							<option value="1/2">1/2</option>
							<option value="1/4">1/4</option>
							<option value="1/8">1/8</option>
							<option value="1/16">1/16</option>
						</select>
						<label className="text-xs flex items-center gap-1">
							<input
								type="checkbox"
								checked={grid.triplet}
								onChange={(e) =>
									setGrid({ ...grid, triplet: e.target.checked })
								}
							/>
							Triplet
						</label>
						<label className="text-xs flex items-center gap-1">
							Swing
							<input
								type="range"
								min="0"
								max="100"
								value={grid.swing || 0}
								onChange={(e) =>
									setGrid({ ...grid, swing: Number(e.target.value) })
								}
								className="w-12"
							/>
						</label>
					</div>
				</div>

				<div className="flex items-center gap-4">
					{/* Musical Group */}
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">Musical:</span>
						<label className="text-xs flex items-center gap-1">
							BPM
							<input
								type="number"
								min={30}
								max={300}
								defaultValue={music.tempoBpm}
								onChange={(e) => {
									const v = Number(e.target.value);
									const clamped = Math.max(30, Math.min(300, Number.isFinite(v) ? v : 120));
									if (bpmDebounceRef.current) clearTimeout(bpmDebounceRef.current);
									bpmDebounceRef.current = setTimeout(
										() => setMusic({ ...music, tempoBpm: clamped }),
										150,
									) as unknown as number;
								}}
								className="w-16 h-7 border rounded px-1 text-xs"
							/>
						</label>
						<label className="text-xs flex items-center gap-1">
							TS
							<select
								className="h-7 border rounded px-1 text-xs"
								defaultValue={music.timeSignature.num}
								onChange={(e) => {
									const target = e.target as HTMLSelectElement & {
										_t?: number;
									};
									const num = Number(target.value) as 2 | 3 | 4 | 5 | 7;
									window.clearTimeout(target._t);
									target._t = window.setTimeout(
										() =>
											setMusic({
												...music,
												timeSignature: { num, den: music.timeSignature.den },
											}),
										150,
									);
								}}
							>
								{[2, 3, 4, 5, 7].map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
							<span>/</span>
							<select
								className="h-7 border rounded px-1 text-xs"
								defaultValue={music.timeSignature.den}
								onChange={(e) => {
									const target = e.target as HTMLSelectElement & {
										_t?: number;
									};
									const den = Number(target.value) as 2 | 4 | 8;
									window.clearTimeout(target._t);
									target._t = window.setTimeout(
										() =>
											setMusic({
												...music,
												timeSignature: { num: music.timeSignature.num, den },
											}),
										150,
									);
								}}
							>
								{[2, 4, 8].map((d) => (
									<option key={d} value={d}>
										{d}
									</option>
								))}
							</select>
						</label>
					</div>
				</div>
			</div>

			<ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
		</>
	);
}
