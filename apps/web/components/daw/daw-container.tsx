"use client";

import {
	addTrackAtom,
	horizontalScrollAtom,
	initializeAudioFromOPFSAtom,
	isPlayingAtom,
	playbackAtom,
	playheadAutoFollowEnabledAtom,
	playheadDraggingAtom,
	setTimelineZoomAtom,
	timelineAtom,
	timelineStaticMetricsAtom,
	timelineWidthAtom,
	trackHeightZoomAtom,
	tracksAtom,
	useBridges,
	useDAWAtomSync,
	useDAWContext,
	userIsManuallyScrollingAtom,
	verticalScrollAtom,
} from "@wav0/daw-react";
import { useAtom, useSetAtom, useStore } from "jotai";
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
import { DAWControls } from "./controls/daw-controls";
import { DAWToolbar } from "./controls/daw-toolbar";
import { GlobalShortcuts } from "./controls/global-shortcuts";
import { ClipEditorDrawer } from "./inspectors/clip-editor-drawer";
import { EventListSheet } from "./inspectors/event-list-sheet";
import { DAWTimeline } from "./panels/daw-timeline";
import { DAWTrackContent } from "./panels/daw-track-content";
import { DAWTrackList } from "./panels/daw-track-list";
import { UnifiedPlayhead } from "./panels/unified-playhead";
import { ClipMoveToastManager } from "./toast/clip-move-toast";

export function DAWContainer() {
	// #region agent log
	fetch('http://127.0.0.1:7242/ingest/0a60aa8d-6783-4d70-bd00-4ed3f63d6711',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'daw-container.tsx:DAWContainer',message:'DAWContainer RENDER',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
	// #endregion
	useDAWAtomSync(playbackAtom, tracksAtom);
	const { audio: audioBridge } = useBridges();
	const daw = useDAWContext();

	const store = useStore();
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [tracks] = useAtom(tracksAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const addTrack = useSetAtom(addTrackAtom);
	const setHorizontalScroll = useSetAtom(horizontalScrollAtom);
	const setVerticalScroll = useSetAtom(verticalScrollAtom);
	const [isPlaying] = useAtom(isPlayingAtom);
	const [_timeline] = useAtom(timelineAtom);
	// Don't subscribe to timelineStaticMetricsAtom - it includes horizontalScroll which changes on every scroll
	// Use store.get() to read zoom directly in event handlers
	// Use store.sub() instead of useAtom to avoid re-renders - value only used in refs
	const isPlayheadDraggingRef = useRef(store.get(playheadDraggingAtom));
	// #region agent log
	fetch('http://127.0.0.1:7242/ingest/0a60aa8d-6783-4d70-bd00-4ed3f63d6711',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'daw-container.tsx:64',message:'isPlayheadDragging ref init',data:{isPlayheadDragging:isPlayheadDraggingRef.current},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1-FIX'})}).catch(()=>{});
	// #endregion
	const initializeAudioFromOPFS = useSetAtom(initializeAudioFromOPFSAtom);
	const setTimelineZoom = useSetAtom(setTimelineZoomAtom);
	// useSetAtom returns stable setter - no subscription, no re-renders on atom change
	const setUserIsScrolling = useSetAtom(userIsManuallyScrollingAtom);
	const setAutoFollowEnabled = useSetAtom(playheadAutoFollowEnabledAtom);

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

	const scrollRef = useRef({ left: 0, top: 0 });
	const autoFollowStateRef = useRef({
		isPlaying,
		isPlayheadDragging: isPlayheadDraggingRef.current,
		userIsScrolling: store.get(userIsManuallyScrollingAtom),
		autoFollowEnabled: store.get(playheadAutoFollowEnabledAtom),
	});

	// Sync refs via store.sub() to avoid re-renders - these values only used in callbacks
	useEffect(() => {
		const unsubs = [
			store.sub(playheadDraggingAtom, () => {
				const value = store.get(playheadDraggingAtom);
				isPlayheadDraggingRef.current = value;
				autoFollowStateRef.current.isPlayheadDragging = value;
			}),
			store.sub(userIsManuallyScrollingAtom, () => {
				autoFollowStateRef.current.userIsScrolling = store.get(userIsManuallyScrollingAtom);
			}),
			store.sub(playheadAutoFollowEnabledAtom, () => {
				autoFollowStateRef.current.autoFollowEnabled = store.get(playheadAutoFollowEnabledAtom);
			}),
		];
		return () => { for (const u of unsubs) u(); };
	}, [store]);

	// Only sync isPlaying via effect (still subscribed via useAtom for UI)
	useEffect(() => {
		autoFollowStateRef.current.isPlaying = isPlaying;
	}, [isPlaying]);

	// Auto-scroll: subscribe to Transport time-update events directly (not playheadViewportAtom)
	// playheadViewportAtom depends on playbackAtom.currentTime which doesn't update during playback
	useEffect(() => {
		if (!daw) return;
		const transport = daw.getTransport();

		const handleTimeUpdate = (event: CustomEvent<{ currentTime: number }>) => {
			const {
				isPlaying: playing,
				isPlayheadDragging: dragging,
				userIsScrolling: scrolling,
				autoFollowEnabled: enabled,
			} = autoFollowStateRef.current;

			if (!playing || dragging || scrolling || !enabled) return;

			const controller = gridControllerRef.current;
			const grid = trackGridScrollRef.current;
			if (!controller || !grid) return;

			const currentPxPerMs = store.get(timelineStaticMetricsAtom).pxPerMs;
			const x = event.detail.currentTime * currentPxPerMs;
			if (!Number.isFinite(x)) return;
			const width = grid.clientWidth;
			if (width <= 100) return; // Skip if viewport too narrow
			const left = controller.scrollLeft;

			// Use wider band margins for narrow viewports (20%-80% vs 35%-65%)
			const marginRatio = width < 400 ? 0.2 : 0.35;
			const bandLeft = left + width * marginRatio;
			const bandRight = left + width * (1 - marginRatio);

			if (x < bandLeft || x > bandRight) {
				const target = Math.max(0, x - width * 0.5);
				if (Math.abs(target - controller.scrollLeft) < 0.5) return;
				controller.setScroll(target, controller.scrollTop);
			}
		};

		transport.addEventListener("time-update", handleTimeUpdate as EventListener);
		return () => {
			transport.removeEventListener("time-update", handleTimeUpdate as EventListener);
		};
	}, [daw, store]);

	const scrollBatchRef = useRef<{
		pending: boolean;
		raf: number;
		nextLeft: number;
		nextTop: number;
	}>({
		pending: false,
		raf: 0,
		nextLeft: 0,
		nextTop: 0,
	});

	const batchScrollUpdate = useCallback(
		(left: number, top: number) => {
			const batch = scrollBatchRef.current;
			batch.nextLeft = left;
			batch.nextTop = top;

			if (batch.pending) return;

			batch.pending = true;
			batch.raf = requestAnimationFrame(() => {
				batch.pending = false;
				batch.raf = 0;
				try {
					setHorizontalScroll(batch.nextLeft);
					setVerticalScroll(batch.nextTop);
				} catch (error) {
					console.warn("[DAWContainer] scroll batch set failed", error);
				}
			});
		},
		[setHorizontalScroll, setVerticalScroll],
	);

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
			batchScrollUpdate(left, top);
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

			const batch = scrollBatchRef.current;
			if (batch.raf) {
				cancelAnimationFrame(batch.raf);
				batch.raf = 0;
				batch.pending = false;
			}
		};
	}, [batchScrollUpdate]);

	// Re-run when audioBridge becomes available to load audio into SDK AudioEngine
	// First run (mount): uses legacy service → loads into legacy storage
	// Second run (bridge ready): uses AudioServiceBridge → loads into SDK + legacy
	// biome-ignore lint/correctness/useExhaustiveDependencies: audioBridge triggers re-init when SDK is ready
	useEffect(() => {
		initializeAudioFromOPFS();
	}, [initializeAudioFromOPFS, audioBridge]);

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

	const onTimelineScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			const left = target.scrollLeft;
			scrollRef.current.left = left;
			scheduleScrollSync(left, scrollRef.current.top);
			batchScrollUpdate(left, scrollRef.current.top);
		},
		[scheduleScrollSync, batchScrollUpdate],
	);

	const onTrackListScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			const top = target.scrollTop;
			scrollRef.current.top = top;
			scheduleScrollSync(scrollRef.current.left, top);
			batchScrollUpdate(scrollRef.current.left, top);
		},
		[scheduleScrollSync, batchScrollUpdate],
	);

	const scrollDebounceRef = useRef<NodeJS.Timeout | null>(null);
	const onTrackGridScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLDivElement;
			const { scrollLeft: left, scrollTop: top } = target;
			scrollRef.current = { left, top };
			scheduleScrollSync(left, top);
			batchScrollUpdate(left, top);

			setUserIsScrolling(true);
			setAutoFollowEnabled(false);

			if (scrollDebounceRef.current) {
				clearTimeout(scrollDebounceRef.current);
			}

			scrollDebounceRef.current = setTimeout(() => {
				setUserIsScrolling(false);

				const controller = gridControllerRef.current;
				const grid = trackGridScrollRef.current;
				if (controller && grid && daw) {
					// Get current playhead position directly from Transport
					const currentTimeMs = daw.getTransport().getCurrentTime();
					const { pxPerMs } = store.get(timelineStaticMetricsAtom);
					const x = currentTimeMs * pxPerMs;
					if (!Number.isFinite(x)) return;
					const width = grid.clientWidth;
					const viewportLeft = controller.scrollLeft;
					const viewportRight = viewportLeft + width;

					if (x >= viewportLeft && x <= viewportRight) {
						setAutoFollowEnabled(true);
					}
				}
			}, 500);
		},
		[
			scheduleScrollSync,
			batchScrollUpdate,
			setUserIsScrolling,
			setAutoFollowEnabled,
			daw,
			store,
		],
	);

	useEffect(() => {
		if (!timelineScrollRef.current || !trackGridScrollRef.current) return;
		const timelineEl = timelineScrollRef.current;
		const gridEl = trackGridScrollRef.current;
		const listEl = trackListScrollRef.current;

		let rafId = 0;
		let controllerScrollLeft = gridEl.scrollLeft;
		let controllerScrollTop = gridEl.scrollTop;

		const controller: GridController = {
			scrollLeft: controllerScrollLeft,
			scrollTop: controllerScrollTop,
			rAF: rafId,
			setScroll(left, top) {
				if (rafId) cancelAnimationFrame(rafId);
				rafId = requestAnimationFrame(() => {
					rafId = 0;
					if (timelineEl.scrollLeft !== left) timelineEl.scrollLeft = left;
					if (gridEl.scrollLeft !== left) gridEl.scrollLeft = left;
					if (gridEl.scrollTop !== top) gridEl.scrollTop = top;
					if (listEl && listEl.scrollTop !== top) listEl.scrollTop = top;
					controllerScrollLeft = left;
					controllerScrollTop = top;
					controller.scrollLeft = controllerScrollLeft;
					controller.scrollTop = controllerScrollTop;
					controller.rAF = rafId;
				});
				controller.rAF = rafId;
			},
			cancelAnimation() {
				if (rafId) cancelAnimationFrame(rafId);
				rafId = 0;
				controller.rAF = rafId;
			},
		};
		gridControllerRef.current = controller;

		const handleWheel = (event: WheelEvent) => {
			if (!event.ctrlKey) return;
			event.preventDefault();
			const delta = event.deltaY;
			const zoomFactor = delta < 0 ? 1.1 : 0.9;
			// Read zoom directly from store to avoid subscription re-renders
			const { zoom } = store.get(timelineStaticMetricsAtom);
			const clamped = Math.min(Math.max(zoom * zoomFactor, 0.05), 5);
			setTimelineZoom(clamped);
		};

		const handlePointerMove = (event: PointerEvent) => {
			if (!(event.buttons & 1)) return;
			if (panLockRef.current) return;
			if (automationDragActiveRef.current) return;
			controller.setScroll(
				controller.scrollLeft - event.movementX,
				controller.scrollTop - event.movementY,
			);
		};

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
	}, [store, setTimelineZoom]);

	useEffect(() => {
		const preventTouchNav = (e: TouchEvent) => {
			if (e.touches && e.touches.length === 2) {
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

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Toolbar */}
			<DAWToolbar />
			{/* Global keyboard shortcuts */}
			<GlobalShortcuts />
			<ClipMoveToastManager />
			<ClipEditorDrawer />
			<EventListSheet />

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
								<UnifiedPlayhead timelineHeaderHeight={DAW_HEIGHTS.TIMELINE} />

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
