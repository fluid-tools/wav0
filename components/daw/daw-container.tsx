"use client";

import { useAtom } from "jotai";
import { Plus } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { DAW_ROW_HEIGHT } from "@/lib/constants";
import {
	addTrackAtom,
	horizontalScrollAtom,
	timelineWidthAtom,
	tracksAtom,
	verticalScrollAtom,
} from "@/lib/state/daw-store";
import { DAWControls } from "./daw-controls";
import { DAWPlayhead } from "./daw-playhead";
import { DAWTimeline } from "./daw-timeline";
import { DAWToolbar } from "./daw-toolbar";
import { DAWTrackContent } from "./daw-track-content";
import { DAWTrackList } from "./daw-track-list";

export function DAWContainer() {
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [tracks] = useAtom(tracksAtom);
	const [, addTrack] = useAtom(addTrackAtom);
	const [, setHorizontalScroll] = useAtom(horizontalScrollAtom);
	const [, setVerticalScroll] = useAtom(verticalScrollAtom);

	const timelineScrollRef = useRef<HTMLDivElement>(null);
	const trackListScrollRef = useRef<HTMLDivElement>(null);
	const trackGridScrollRef = useRef<HTMLDivElement>(null);
	const gridContainerRef = useRef<HTMLDivElement>(null);

	// Calculate content dimensions
	const contentHeight = Math.max(tracks.length * DAW_ROW_HEIGHT, 400);

	// Sync horizontal scroll
	const handleHorizontalScroll = useCallback(
		(scrollLeft: number) => {
			setHorizontalScroll(scrollLeft);

			// Update timeline scroll
			if (
				timelineScrollRef.current &&
				timelineScrollRef.current.scrollLeft !== scrollLeft
			) {
				timelineScrollRef.current.scrollLeft = scrollLeft;
			}

			// Update grid scroll
			if (
				trackGridScrollRef.current &&
				trackGridScrollRef.current.scrollLeft !== scrollLeft
			) {
				trackGridScrollRef.current.scrollLeft = scrollLeft;
			}
		},
		[setHorizontalScroll],
	);

	// Sync vertical scroll
	const handleVerticalScroll = useCallback(
		(scrollTop: number) => {
			setVerticalScroll(scrollTop);

			// Update track list scroll
			if (
				trackListScrollRef.current &&
				trackListScrollRef.current.scrollTop !== scrollTop
			) {
				trackListScrollRef.current.scrollTop = scrollTop;
			}

			// Update grid scroll
			if (
				trackGridScrollRef.current &&
				trackGridScrollRef.current.scrollTop !== scrollTop
			) {
				trackGridScrollRef.current.scrollTop = scrollTop;
			}
		},
		[setVerticalScroll],
	);

	// Timeline scroll handler
	const onTimelineScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			handleHorizontalScroll(target.scrollLeft);
		},
		[handleHorizontalScroll],
	);

	// Track list scroll handler
	const onTrackListScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			handleVerticalScroll(target.scrollTop);
		},
		[handleVerticalScroll],
	);

	// Track grid scroll handler
	const onTrackGridScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			handleHorizontalScroll(target.scrollLeft);
			handleVerticalScroll(target.scrollTop);
		},
		[handleHorizontalScroll, handleVerticalScroll],
	);

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Toolbar */}
			<DAWToolbar />

			{/* Main DAW Interface */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Transport Controls */}
				<DAWControls />

				{/* Timeline + Tracks Layout */}
				<div className="flex-1 flex overflow-hidden">
					<ResizablePanelGroup direction="horizontal" className="h-full">
						{/* Track List Panel */}
						<ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
							<div className="h-full border-r flex flex-col">
								{/* Track List Header */}
								<div className="h-16 border-b bg-muted/10 flex items-center justify-between px-4">
									<h3 className="text-sm font-medium">Tracks</h3>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											const trackNumber = tracks.length + 1;
											const colorIndex = tracks.length % 8;
											const colors = [
												"#3b82f6",
												"#ef4444",
												"#10b981",
												"#f59e0b",
												"#8b5cf6",
												"#06b6d4",
												"#f97316",
												"#84cc16",
											];

											addTrack({
												name: `Track ${trackNumber}`,
												duration: 0,
												startTime: 0,
												trimStart: 0,
												trimEnd: 0,
												volume: 75,
												muted: false,
												soloed: false,
												color: colors[colorIndex],
											});
										}}
										className="h-8 w-8 p-0"
									>
										<Plus className="w-4 h-4" />
									</Button>
								</div>

								{/* Track List Content */}
								<div className="flex-1 overflow-hidden">
									<div
										ref={trackListScrollRef}
										className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin"
										onScroll={onTrackListScroll}
									>
										<div style={{ height: contentHeight }}>
											<DAWTrackList />
										</div>
									</div>
								</div>
							</div>
						</ResizablePanel>

						<ResizableHandle />

						{/* Timeline and Grid Panel */}
						<ResizablePanel defaultSize={75}>
							<div className="h-full flex flex-col">
								{/* Timeline Header */}
								<div className="h-16 border-b bg-muted/10 relative overflow-hidden">
									<div
										ref={timelineScrollRef}
										className="h-full overflow-x-auto overflow-y-hidden scrollbar-none"
										onScroll={onTimelineScroll}
									>
										<div style={{ width: timelineWidth, height: "100%" }}>
											<DAWTimeline />
										</div>
									</div>
								</div>

								{/* Track Content Grid */}
								<div
									className="flex-1 overflow-hidden relative"
									ref={gridContainerRef}
								>
									<div
										ref={trackGridScrollRef}
										className="h-full w-full overflow-auto scrollbar-thin"
										onScroll={onTrackGridScroll}
									>
										<div
											style={{
												width: timelineWidth,
												height: contentHeight,
												position: "relative",
											}}
										>
											<DAWTrackContent />
										</div>
									</div>

									{/* Playhead Component */}
									<DAWPlayhead containerRef={gridContainerRef} />
								</div>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
}
