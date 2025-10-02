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
	playheadAutoFollowEnabledAtom,
	playheadDraggingAtom,
	playheadViewportAtom,
	setTimelineZoomAtom,
	timelineAtom,
	timelineViewportAtom,
	timelineWidthAtom,
	trackHeightZoomAtom,
	tracksAtom,
	userIsManuallyScrollingAtom,
	verticalScrollAtom,
} from "@/lib/state/daw-store";
import { DAWControls } from "./controls/daw-controls";
import { DAWToolbar } from "./controls/daw-toolbar";
import { GlobalShortcuts } from "./controls/global-shortcuts";
import { ClipEditorDrawer } from "./inspectors/clip-editor-drawer";
import { EventListSheet } from "./inspectors/event-list-sheet";
import { AudioTestPanel } from "./panels/audio-test-panel";
import { DAWTimeline } from "./panels/daw-timeline";
import { DAWTrackContent } from "./panels/daw-track-content";
import { DAWTrackList } from "./panels/daw-track-list";
import { UnifiedOverlay } from "./unified-overlay";

export function DAWContainer() {
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [tracks] = useAtom(tracksAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [, addTrack] = useAtom(addTrackAtom);
	const [, setHorizontalScroll] = useAtom(horizontalScrollAtom);
	const [, setVerticalScroll] = useAtom(verticalScrollAtom);
	const [playback] = useAtom(playbackAtom);
	const [_timeline] = useAtom(timelineAtom);
	const [viewport] = useAtom(timelineViewportAtom);
	const [playheadViewport] = useAtom(playheadViewportAtom);
	const [isPlayheadDragging] = useAtom(playheadDraggingAtom);
	const [, initializeAudioFromOPFS] = useAtom(initializeAudioFromOPFSAtom);
	const [, setTimelineZoom] = useAtom(setTimelineZoomAtom);
	const [userIsScrolling, setUserIsScrolling] = useAtom(
		userIsManuallyScrollingAtom,
	);
	const [autoFollowEnabled, setAutoFollowEnabled] = useAtom(
		playheadAutoFollowEnabledAtom,
	);

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
	const automationDragActiveRef = useRef(false);
	const panLockRef = useRef(false);

	/**
	 * Cache zoom and scroll state locally so wheel + pointer interactions
	 * stay smooth between atom commits.
	 */
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

		const handleScrollRequest = (event: Event) => {
			const customEvent = event as CustomEvent<{
				left?: number;
				top?: number;
			}>;
			const detail = customEvent.detail || {};
			const controller = gridControllerRef.current;
			if (!controller) return;
			const left =
				detail.left !== undefined ? detail.left : controller.scrollLeft;
			const top = detail.top !== undefined ? detail.top : controller.scrollTop;
			controller.setScroll(left, top);
			setHorizontalScroll(left);
			setVerticalScroll(top);
		};
		window.addEventListener(
			"wav0:grid-pan-lock",
			handlePanLock as EventListener,
		);
		window.addEventListener(
			"wav0:grid-scroll-request",
			handleScrollRequest as EventListener,
		);
		return () => {
			window.removeEventListener(
				"wav0:grid-pan-lock",
				handlePanLock as EventListener,
			);
			window.removeEventListener(
				"wav0:grid-scroll-request",
				handleScrollRequest as EventListener,
			);
		};
	}, [setHorizontalScroll, setVerticalScroll]);

	// Initialize audio from OPFS on component mount
	useEffect(() => {
		initializeAudioFromOPFS();
	}, [initializeAudioFromOPFS]);

	// Calculate content dimensions with global track height
	const currentTrackHeight = Math.round(
		DAW_HEIGHTS.TRACK_ROW * trackHeightZoom,
	);
	const contentHeight = Math.max(tracks.length * currentTrackHeight, 400);

	const scheduleScrollSync = useCallback(
		(scrollLeft: number, scrollTop: number) => {
			const controller = gridControllerRef.current;
			if (!controller) return;
			controller.setScroll(scrollLeft, scrollTop);
			scrollRef.current = { left: scrollLeft, top: scrollTop };
		},
		[],
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

	// Track grid scroll handler with user scroll detection
	const scrollDebounceRef = useRef<NodeJS.Timeout | null>(null);
	const onTrackGridScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			const { scrollLeft: left, scrollTop: top } = target;
			scrollRef.current = { left, top };
			scheduleScrollSync(left, top);
			setHorizontalScroll(left);
			setVerticalScroll(top);

			// Mark user as scrolling
			setUserIsScrolling(true);
			setAutoFollowEnabled(false);

			// Clear existing debounce
			if (scrollDebounceRef.current) {
				clearTimeout(scrollDebounceRef.current);
			}

			// After 500ms of no scrolling, check if playhead is visible
			scrollDebounceRef.current = setTimeout(() => {
				setUserIsScrolling(false);

				// Re-enable auto-follow if playhead is within viewport
				const controller = gridControllerRef.current;
				const grid = trackGridScrollRef.current;
				if (controller && grid) {
					const x = playheadViewport.absolutePx;
					const width = grid.clientWidth;
					const viewportLeft = controller.scrollLeft;
					const viewportRight = viewportLeft + width;

					// If playhead is visible, re-enable auto-follow
					if (x >= viewportLeft && x <= viewportRight) {
						setAutoFollowEnabled(true);
					}
				}
			}, 500);
		},
		[
			scheduleScrollSync,
			setHorizontalScroll,
			setVerticalScroll,
			setUserIsScrolling,
			setAutoFollowEnabled,
			playheadViewport.absolutePx,
		],
	);

	useEffect(() => {
		if (!timelineScrollRef.current || !trackGridScrollRef.current) return;
		const timelineEl = timelineScrollRef.current;
		const gridEl = trackGridScrollRef.current;
		const listEl = trackListScrollRef.current;

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
					if (listEl && listEl.scrollTop !== top) listEl.scrollTop = top;
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
			if (automationDragActiveRef.current) return; // Don't scroll during automation drag
			controller.setScroll(
				controller.scrollLeft - event.movementX,
				controller.scrollTop - event.movementY,
			);
		};

		// Listen for automation drag events
		const handleAutomationDragStart = () => {
			automationDragActiveRef.current = true;
		};
		const handleAutomationDragEnd = () => {
			automationDragActiveRef.current = false;
		};

		gridEl.addEventListener("wheel", handleWheel, { passive: false });
		gridEl.addEventListener("pointermove", handlePointerMove);
		window.addEventListener(
			"wav0:automation-drag-start",
			handleAutomationDragStart,
		);
		window.addEventListener(
			"wav0:automation-drag-end",
			handleAutomationDragEnd,
		);

		return () => {
			gridControllerRef.current = null;
			controller.cancelAnimation();
			gridEl.removeEventListener("wheel", handleWheel);
			gridEl.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener(
				"wav0:automation-drag-start",
				handleAutomationDragStart,
			);
			window.removeEventListener(
				"wav0:automation-drag-end",
				handleAutomationDragEnd,
			);
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

	// Smart playhead-follow with user scroll detection
	useEffect(() => {
		const controller = gridControllerRef.current;
		const grid = trackGridScrollRef.current;
		if (!controller || !grid) return;

		// Don't auto-scroll if user is dragging playhead
		if (isPlayheadDragging) return;

		// Don't auto-scroll if user is manually scrolling
		if (userIsScrolling) return;

		// Don't auto-scroll if auto-follow is disabled
		if (!autoFollowEnabled) return;

		// Don't auto-scroll if not playing
		if (!playback.isPlaying) return;

		const x = playheadViewport.absolutePx;
		if (!Number.isFinite(x)) return;
		const width = grid.clientWidth;
		if (width <= 0) return;
		const left = controller.scrollLeft;

		// Define center band (35-65% of viewport)
		const bandLeft = left + width * 0.35;
		const bandRight = left + width * 0.65;

		// Auto-scroll to keep playhead centered when it exits the band
		if (x < bandLeft || x > bandRight) {
			const target = Math.max(0, x - width * 0.5);
			if (Math.abs(target - controller.scrollLeft) < 0.5) return;
			controller.setScroll(target, controller.scrollTop);
		}
	}, [
		isPlayheadDragging,
		playheadViewport.absolutePx,
		userIsScrolling,
		autoFollowEnabled,
		playback.isPlaying,
	]);

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Toolbar */}
			<DAWToolbar />
			{/* Global keyboard shortcuts */}
			<GlobalShortcuts />
			<ClipEditorDrawer />
			<EventListSheet />

			{/* Main DAW Interface */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Transport Controls */}
				<DAWControls />

				{/* Temporary Audio Test Panel */}
				{/* <div className="border-b p-2">
					<AudioTestPanel />
				</div> */}

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
