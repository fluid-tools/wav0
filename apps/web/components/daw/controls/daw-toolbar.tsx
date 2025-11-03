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
import { useRef, useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { DAW_HEIGHTS, DAW_ICONS, DAW_TEXT } from "@/lib/constants/daw-design";
import {
	automationViewEnabledAtom,
	eventListOpenAtom,
	musicalMetadataAtom,
	projectNameAtom,
	setCustomSnapIntervalAtom,
	setSnapGranularityAtom,
	snapIntervalMsAtom,
	timelineAtom,
	toggleSnapToGridAtom,
} from "@/lib/daw-sdk";

function SnapGranularityControls() {
	const [timeline] = useAtom(timelineAtom);
	const [snapInterval] = useAtom(snapIntervalMsAtom);
	const [, setSnapGranularity] = useAtom(setSnapGranularityAtom);
	const [, setCustomInterval] = useAtom(setCustomSnapIntervalAtom);
	const [, toggleSnap] = useAtom(toggleSnapToGridAtom);

	const formatInterval = (ms: number) => {
		if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
		return `${Math.round(ms)}ms`;
	};

	return (
		<div className="flex items-center gap-2">
			<span className="text-xs text-muted-foreground">Snap:</span>
			<Toggle
				pressed={timeline.snapToGrid}
				onPressedChange={() => toggleSnap()}
				aria-label="Toggle snap to grid"
				size="sm"
				className="h-7 px-2 text-xs"
			>
				{timeline.snapToGrid ? "On" : "Off"}
			</Toggle>
			{timeline.snapToGrid && (
				<>
					<Select
						value={timeline.snapGranularity}
						onValueChange={(value: string) =>
							setSnapGranularity(value as "coarse" | "medium" | "fine" | "custom")
						}
					>
						<SelectTrigger className="h-7 w-20 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="coarse">Coarse</SelectItem>
							<SelectItem value="medium">Medium</SelectItem>
							<SelectItem value="fine">Fine</SelectItem>
							<SelectItem value="custom">Custom</SelectItem>
						</SelectContent>
					</Select>
					{timeline.snapGranularity === "custom" && (
						<Input
							type="number"
							min={1}
							step={1}
							value={timeline.customSnapIntervalMs ?? 100}
							onChange={(e) => {
								const val = Number(e.target.value);
								if (!Number.isNaN(val) && val > 0) {
									setCustomInterval(val);
								}
							}}
							className="w-16 h-7 text-xs"
							placeholder="ms"
						/>
					)}
					<span className="text-xs text-muted-foreground">
						({formatInterval(snapInterval)})
					</span>
				</>
			)}
		</div>
	);
}

export function DAWToolbar() {
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
						<Button
							variant="ghost"
							size="sm"
							disabled
							title="Coming soon"
							aria-label="Open project"
						>
							<FolderOpen className={DAW_ICONS.MD} />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							disabled
							title="Coming soon"
							aria-label="Save project"
						>
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
					{/* Grid Group - Time Mode Only */}
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">Grid:</span>
						<span className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">
							Time
						</span>
						{/* Bars mode temporarily disabled - controls hidden */}
					</div>

					{/* Snap Controls */}
					<SnapGranularityControls />
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
									const clamped = Math.max(
										30,
										Math.min(300, Number.isFinite(v) ? v : 120),
									);
									if (bpmDebounceRef.current)
										clearTimeout(bpmDebounceRef.current);
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
