"use client";

import { useAtom } from "jotai";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
	DAW_COLORS,
	DAW_HEIGHTS,
	DAW_ICONS,
	DAW_SPACING,
	DAW_TEXT,
} from "@/lib/constants/daw-design";
import {
	addTrackAtom,
	horizontalScrollAtom,
	initializeAudioFromOPFSAtom,
	playbackAtom,
	setTimelineZoomAtom,
	timelineAtom,
	timelineViewportAtom,
	timelineWidthAtom,
	trackHeightZoomAtom,
	tracksAtom,
	verticalScrollAtom,
} from "@/lib/state/daw-store";
import { AudioTestPanel } from "./audio-test-panel";
import { DAWControls } from "./daw-controls";
import { DAWTimeline } from "./daw-timeline";
import { DAWToolbar } from "./daw-toolbar";
import { DAWTrackContent } from "./daw-track-content";
import { DAWTrackList } from "./daw-track-list";
import { GlobalShortcuts } from "./global-shortcuts";
import { UnifiedOverlay } from "./unified-overlay";

export function DAWContainer() {
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [tracks] = useAtom(tracksAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [, addTrack] = useAtom(addTrackAtom);
	const [, setHorizontalScroll] = useAtom(horizontalScrollAtom);
	const [, setVerticalScroll] = useAtom(verticalScrollAtom);
	const [playback] = useAtom(playbackAtom);
	const [timeline] = useAtom(timelineAtom);
	const [viewport] = useAtom(timelineViewportAtom);
	const [, initializeAudioFromOPFS] = useAtom(initializeAudioFromOPFSAtom);
	const [, setTimelineZoom] = useAtom(setTimelineZoomAtom);

	const timelineScrollRef = useRef<HTMLDivElement>(null);
	const trackListScrollRef = useRef<HTMLDivElement>(null);
	const trackGridScrollRef = useRef<HTMLDivElement>(null);
	type GridController = {
		setScroll(left: number, top: number): void;
		cancelAnimation(): void;
		scrollLeft: number;
		scrollTop: number;
		rAF: number;
	};
	const gridControllerRef = useRef<GridController | null>(null);
	const panLockRef = useRef(false);

	/**
	 * Cache zoom and scroll state locally so wheel + pointer interactions
	 * stay smooth between atom commits.
	 */
	const zoomRef = useRef(timeline.zoom);
	const scrollRef = useRef({ left: 0, top: 0 });

	useEffect(() => {
		const handlePanLock = (event: Event) => {
			const customEvent = event as CustomEvent<boolean>;
			const locked = Boolean(customEvent.detail);
			panLockRef.current = locked;
			if (locked) {
				gridControllerRef.current?.cancelAnimation();
			}
		};
		window.addEventListener("wav0:grid-pan-lock", handlePanLock as EventListener);
		return () => {
			window.removeEventListener(
				"wav0:grid-pan-lock",
				handlePanLock as EventListener,
			);
		};
	}, []);

	// Initialize audio from OPFS on component mount
	useEffect(() => {
		initializeAudioFromOPFS();
	}, [initializeAudioFromOPFS]);

	// Calculate content dimensions with global track height
	const currentTrackHeight = Math.round(
		DAW_HEIGHTS.TRACK_ROW * trackHeightZoom,
	);
	const contentHeight = Math.max(tracks.length * currentTrackHeight, 400);

	const scheduleScrollSync = useCallback((scrollLeft: number, scrollTop: number) => {
		const controller = gridControllerRef.current;
		if (!controller) return;
		controller.setScroll(scrollLeft, scrollTop);
		scrollRef.current = { left: scrollLeft, top: scrollTop };
	}, []);

	const handleHorizontalScroll = useCallback(
		(scrollLeft: number) => {
			setHorizontalScroll(scrollLeft);
			scheduleScrollSync(scrollLeft, scrollRef.current.top);
		},
		[setHorizontalScroll, scheduleScrollSync],
	);

	const handleVerticalScroll = useCallback(
		(scrollTop: number) => {
			setVerticalScroll(scrollTop);
			scheduleScrollSync(scrollRef.current.left, scrollTop);
		},
		[setVerticalScroll, scheduleScrollSync],
	);

	// Timeline scroll handler
	const onTimelineScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			const left = target.scrollLeft;
			scrollRef.current.left = left;
			scheduleScrollSync(left, scrollRef.current.top);
			setHorizontalScroll(left);
		},
		[scheduleScrollSync, setHorizontalScroll],
	);

	// Track list scroll handler
	const onTrackListScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			const top = target.scrollTop;
			scrollRef.current.top = top;
			scheduleScrollSync(scrollRef.current.left, top);
			setVerticalScroll(top);
		},
		[scheduleScrollSync, setVerticalScroll],
	);

	// Track grid scroll handler
	const onTrackGridScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			const { scrollLeft: left, scrollTop: top } = target;
			scrollRef.current = { left, top };
			scheduleScrollSync(left, top);
			setHorizontalScroll(left);
			setVerticalScroll(top);
		},
		[scheduleScrollSync, setHorizontalScroll, setVerticalScroll],
	);

	useEffect(() => {
		if (!timelineScrollRef.current || !trackGridScrollRef.current) return;
		const timelineEl = timelineScrollRef.current;
		const gridEl = trackGridScrollRef.current;

	const controller: GridController = {
			scrollLeft: gridEl.scrollLeft,
			scrollTop: gridEl.scrollTop,
			rAF: 0,
		setScroll(left, top) {
				if (this.rAF) cancelAnimationFrame(this.rAF);
				this.rAF = requestAnimationFrame(() => {
					this.rAF = 0;
					if (timelineEl.scrollLeft !== left) timelineEl.scrollLeft = left;
					if (gridEl.scrollLeft !== left) gridEl.scrollLeft = left;
					if (gridEl.scrollTop !== top) gridEl.scrollTop = top;
					this.scrollLeft = left;
					this.scrollTop = top;
				});
			},
		cancelAnimation() {
				if (this.rAF) cancelAnimationFrame(this.rAF);
				this.rAF = 0;
			},
		};
		gridControllerRef.current = controller;

		const handleWheel = (event: WheelEvent) => {
			if (!event.ctrlKey) return;
			event.preventDefault();
			const delta = event.deltaY;
			const zoomFactor = delta < 0 ? 1.1 : 0.9;
			const { zoom } = viewport;
			const clamped = Math.min(Math.max(zoom * zoomFactor, 0.05), 5);
			setTimelineZoom(clamped);
		};

		const handlePointerMove = (event: PointerEvent) => {
			if (!(event.buttons & 1)) return;
			if (panLockRef.current) return;
			controller.setScroll(
				controller.scrollLeft - event.movementX,
				controller.scrollTop - event.movementY,
			);
		};

		gridEl.addEventListener("wheel", handleWheel, { passive: false });
		gridEl.addEventListener("pointermove", handlePointerMove);

		return () => {
			gridControllerRef.current = null;
			controller.cancelAnimation();
			gridEl.removeEventListener("wheel", handleWheel);
			gridEl.removeEventListener("pointermove", handlePointerMove);
		};
	}, [viewport, setTimelineZoom]);

	useEffect(() => {
		// Prevent back/forward swipe gestures interfering with DAW grid
		const preventTouchNav = (e: TouchEvent) => {
			if (e.touches && e.touches.length === 2) {
				// pinch zoom
				e.preventDefault();
			}
		};
		document.body.style.overscrollBehavior = "none";
		document.addEventListener("touchstart", preventTouchNav, {
			passive: false,
		});
		return () => {
			document.body.style.overscrollBehavior = "";
			document.removeEventListener("touchstart", preventTouchNav);
		};
	}, []);

	// Playhead-follow: keep playhead within center band
	useEffect(() => {
		if (!timelineScrollRef.current || !trackGridScrollRef.current) return;
		const x = playback.currentTime * viewport.pxPerMs;
		const grid = trackGridScrollRef.current;
		const left = grid.scrollLeft;
		const _right = left + grid.clientWidth;
		const bandLeft = left + grid.clientWidth * 0.35;
		const bandRight = left + grid.clientWidth * 0.65;
		if (x < bandLeft || x > bandRight) {
			const target = Math.max(0, x - grid.clientWidth * 0.5);
			grid.scrollTo({ left: target });
			timelineScrollRef.current.scrollTo({ left: target });
		}
	}, [playback.currentTime, viewport.pxPerMs]);

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Toolbar */}
			<DAWToolbar />
			{/* Global keyboard shortcuts */}
			<GlobalShortcuts />

			{/* Main DAW Interface */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Transport Controls */}
				<DAWControls />

				{/* Temporary Audio Test Panel */}
				<div className="border-b p-2">
					<AudioTestPanel />
				</div>

				{/* Timeline + Tracks Layout */}
				<div className="flex-1 flex overflow-hidden">
					<ResizablePanelGroup direction="horizontal" className="h-full">
						{/* Track List Panel */}
						<ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
							<div className="h-full border-r flex flex-col">
								{/* Track List Header */}
								<div
									className="border-b flex items-center justify-between"
									style={{
										height: DAW_HEIGHTS.TIMELINE,
										backgroundColor: "hsl(var(--muted) / 0.1)",
										padding: `0 ${DAW_SPACING.SECTION_PADDING}px`,
									}}
								>
									<h3 className={DAW_TEXT.SECTION_TITLE}>Tracks</h3>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											const trackNumber = tracks.length + 1;
											const colorIndex =
												tracks.length % DAW_COLORS.TRACK_COLORS.length;

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
										style={{
											height: DAW_HEIGHTS.BUTTON_MD,
											width: DAW_HEIGHTS.BUTTON_MD,
										}}
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
							<div className="relative h-full flex flex-col overflow-hidden">
								<UnifiedOverlay />
								{/* Timeline Header */}
								<div
									className="border-b relative overflow-hidden z-10"
									style={{
										height: DAW_HEIGHTS.TIMELINE,
										backgroundColor: "hsl(var(--muted) / 0.1)",
									}}
								>
									<div
										ref={timelineScrollRef}
										className="h-full overflow-x-auto overflow-y-hidden"
										data-daw-timeline-scroll="true"
										onScroll={onTimelineScroll}
										style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
									>
										<div style={{ width: timelineWidth, height: "100%" }}>
											<DAWTimeline />
										</div>
									</div>
								</div>

								{/* Track Content Grid */}
								<div className="relative z-10 flex-1 overflow-hidden">
									<div
										ref={trackGridScrollRef}
										className="h-full w-full overflow-auto"
										data-daw-grid-scroll="true"
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
								</div>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
}
