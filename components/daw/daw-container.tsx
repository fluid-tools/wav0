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
import { DAW_COLORS, DAW_HEIGHTS, DAW_ICONS, DAW_SPACING, DAW_TEXT } from "@/lib/constants/daw-design";
import {
	addTrackAtom,
	horizontalScrollAtom,
	timelineWidthAtom,
	trackHeightZoomAtom,
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
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [, addTrack] = useAtom(addTrackAtom);
	const [, setHorizontalScroll] = useAtom(horizontalScrollAtom);
	const [, setVerticalScroll] = useAtom(verticalScrollAtom);

	const timelineScrollRef = useRef<HTMLDivElement>(null);
	const trackListScrollRef = useRef<HTMLDivElement>(null);
	const trackGridScrollRef = useRef<HTMLDivElement>(null);
	const gridContainerRef = useRef<HTMLDivElement>(null);

	// Calculate content dimensions with global track height
	const currentTrackHeight = Math.round(DAW_HEIGHTS.TRACK_ROW * trackHeightZoom);
	const contentHeight = Math.max(tracks.length * currentTrackHeight, 400);

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
								<div className="border-b flex items-center justify-between" style={{ height: DAW_HEIGHTS.TIMELINE, backgroundColor: 'hsl(var(--muted) / 0.1)', padding: `0 ${DAW_SPACING.SECTION_PADDING}px` }}>
									<h3 className={DAW_TEXT.SECTION_TITLE}>Tracks</h3>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											const trackNumber = tracks.length + 1;
											const colorIndex = tracks.length % DAW_COLORS.TRACK_COLORS.length;

											addTrack({
												name: `Track ${trackNumber}`,
												duration: 0,
												startTime: 0,
												trimStart: 0,
												trimEnd: 0,
												volume: 75,
												muted: false,
												soloed: false,
												color: DAW_COLORS.TRACK_COLORS[colorIndex],
											});
										}}
										style={{ height: DAW_HEIGHTS.BUTTON_MD, width: DAW_HEIGHTS.BUTTON_MD }}
										className="p-0"
									>
										<Plus className={DAW_ICONS.MD} />
									</Button>
								</div>

								{/* Track List Content */}
								<div className="flex-1 overflow-hidden">
									<div
										ref={trackListScrollRef}
										className="h-full overflow-y-auto overflow-x-hidden"
										onScroll={onTrackListScroll}
										style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
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
								<div className="border-b relative overflow-hidden" style={{ height: DAW_HEIGHTS.TIMELINE, backgroundColor: 'hsl(var(--muted) / 0.1)' }}>
									<div
										ref={timelineScrollRef}
										className="h-full overflow-x-auto overflow-y-hidden"
										onScroll={onTimelineScroll}
										style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
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
										className="h-full w-full overflow-auto"
										onScroll={onTrackGridScroll}
										style={{ scrollbarWidth: "thin" }}
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
