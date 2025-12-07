"use client";

import {
	horizontalScrollAtom,
	playheadDraggingAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
	useDAWContext,
	useTimebase,
} from "@wav0/daw-react";
import { time } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import {
	memo,
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
} from "react";

type Props = {
	timelineHeaderHeight: number;
};

/**
 * UnifiedPlayhead - Performance-optimized playhead component
 *
 * During drag: Updates DOM directly via refs, bypassing React state entirely.
 * This eliminates the cascading re-renders that cause jank on rapid movements.
 * Only syncs to React state on drag end.
 *
 * During playback: Uses useLayoutEffect to update transforms synchronously.
 */
export const UnifiedPlayhead = memo(function UnifiedPlayhead({
	timelineHeaderHeight,
}: Props) {
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const [timeline] = useAtom(timelineAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, setPlayheadDragging] = useAtom(playheadDraggingAtom);
	const daw = useDAWContext();
	const readTransport = useEffectEvent(() => daw?.getTransport());
	const currentTimeRef = useRef(0);

	useEffect(() => {
		const transport = readTransport();
		if (!transport) return;
		currentTimeRef.current = transport.getCurrentTime();
	}, [readTransport]);

	const containerRef = useRef<HTMLDivElement>(null);
	const playheadLineRef = useRef<HTMLDivElement>(null);
	const playheadHandleRef = useRef<HTMLButtonElement>(null);

	// Store current metrics in refs to avoid stale closures during drag
	const metricsRef = useRef({ pxPerMs, horizontalScroll, snapToGrid: timeline.snapToGrid });
	metricsRef.current = { pxPerMs, horizontalScroll, snapToGrid: timeline.snapToGrid };

	const dragRef = useRef<{
		active: boolean;
		pointerId: number | null;
		lastMs: number;
		pendingMs: number;
		visualRaf: number; // Separate RAF for visual updates
	}>({
		active: false,
		pointerId: null,
		lastMs: 0,
		pendingMs: 0,
		visualRaf: 0,
	});

	const { snap } = useTimebase();
	const snapRef = useRef(snap);
	snapRef.current = snap;

	// Direct DOM update function - bypasses React entirely
	const updatePlayheadVisual = useCallback((timeMs: number) => {
		if (!playheadLineRef.current || !playheadHandleRef.current) return;
		const { pxPerMs: px, horizontalScroll: scroll } = metricsRef.current;
		const playheadX = Math.round(time.timeToPixel(timeMs, px, scroll));
		playheadLineRef.current.style.transform = `translateX(${playheadX}px)`;
		playheadHandleRef.current.style.transform = `translateX(${playheadX - 12}px)`;
	}, []);

	useEffect(() => {
		const transport = readTransport();
		if (!transport) return;

		const handleTimeUpdate = (event: CustomEvent<{ currentTime: number }>) => {
			if (dragRef.current.active) return;
			const timeMs = event.detail.currentTime;
			currentTimeRef.current = timeMs;
			if (!playheadLineRef.current || !playheadHandleRef.current) return;
			const { pxPerMs: px, horizontalScroll: scroll } = metricsRef.current;
			const playheadX = Math.round(time.timeToPixel(timeMs, px, scroll));
			playheadLineRef.current.style.transform = `translateX(${playheadX}px)`;
			playheadHandleRef.current.style.transform = `translateX(${playheadX - 12}px)`;
		};

		const handleTransport = (event: CustomEvent<{ currentTime: number }>) => {
			if (dragRef.current.active) return;
			const timeMs = event.detail.currentTime;
			currentTimeRef.current = timeMs;
			updatePlayheadVisual(timeMs);
		};

		transport.addEventListener("time-update", handleTimeUpdate as EventListener);
		transport.addEventListener("transport", handleTransport as EventListener);

		return () => {
			transport.removeEventListener("time-update", handleTimeUpdate as EventListener);
			transport.removeEventListener("transport", handleTransport as EventListener);
		};
	}, [readTransport, updatePlayheadVisual]);

	// Sync visual position when metrics change (zoom, scroll) - NOT from time changes
	useLayoutEffect(() => {
		// Skip if dragging - drag handles its own visual updates
		if (dragRef.current.active) return;

		// Update using latest time from ref
		if (!playheadLineRef.current || !playheadHandleRef.current) return;
		const timeMs = currentTimeRef.current;
		const playheadX = Math.round(time.timeToPixel(timeMs, pxPerMs, horizontalScroll));
		playheadLineRef.current.style.transform = `translateX(${playheadX}px)`;
		playheadHandleRef.current.style.transform = `translateX(${playheadX - 12}px)`;
	}, [pxPerMs, horizontalScroll]);

	// Calculate time from pointer position
	const getTimeFromPointer = useCallback((clientX: number): number | null => {
		const { pxPerMs: px, horizontalScroll: scroll, snapToGrid } = metricsRef.current;
		if (px <= 0) return null;

		const timelineScrollContainer = document.querySelector('[data-daw-timeline-scroll="true"]') as
			| HTMLElement
			| null;
		if (!timelineScrollContainer) return null;

		const rect = timelineScrollContainer.getBoundingClientRect();
		const viewportX = Math.max(0, clientX - rect.left);
		if (!Number.isFinite(viewportX)) return null;

		const rawMs = Math.max(
			0,
			time.pixelToTime(viewportX, px, timelineScrollContainer.scrollLeft ?? scroll),
		);
		return snapToGrid ? snapRef.current(rawMs) : rawMs;
	}, []);

	const updateTime = useCallback(
		(clientX: number) => {
			const nextMs = getTimeFromPointer(clientX);
			if (nextMs === null) return;

			const state = dragRef.current;
			if (!state.active) {
				// Not dragging - update React state directly
				setCurrentTime(nextMs);
				return;
			}

			// During drag: Update visual immediately, skip React state
			state.lastMs = nextMs;
			state.pendingMs = nextMs;

			// Visual update via RAF for smooth 60fps
			if (!state.visualRaf) {
				state.visualRaf = requestAnimationFrame(() => {
					state.visualRaf = 0;
					updatePlayheadVisual(state.pendingMs);
				});
			}
		},
		[getTimeFromPointer, setCurrentTime, updatePlayheadVisual],
	);

	const stopDrag = useCallback(() => {
		const state = dragRef.current;
		const element = playheadHandleRef.current;

		// Cancel any pending visual RAF
		if (state.visualRaf) {
			cancelAnimationFrame(state.visualRaf);
			state.visualRaf = 0;
		}

		// Release pointer capture
		if (element && state.pointerId !== null && element.hasPointerCapture?.(state.pointerId)) {
			try {
				element.releasePointerCapture(state.pointerId);
			} catch {}
		}

		// Sync final position to React state ONCE
		if (state.active && state.pendingMs !== currentTimeRef.current) {
			setCurrentTime(state.pendingMs);
			currentTimeRef.current = state.pendingMs;
		}

		// Reset drag state
		state.active = false;
		state.pointerId = null;
		state.lastMs = 0;
		state.pendingMs = 0;

		setPlayheadDragging(false);
	}, [setCurrentTime, setPlayheadDragging]);

	// Handle pointer events for dragging
	useLayoutEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			const state = dragRef.current;
			if (!state.active || state.pointerId !== event.pointerId) return;
			updateTime(event.clientX);
		};

		const handlePointerUp = (event: PointerEvent) => {
			const state = dragRef.current;
			if (!state.active || state.pointerId !== event.pointerId) return;
			stopDrag();
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerUp);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
			window.removeEventListener("pointercancel", handlePointerUp);
		};
	}, [stopDrag, updateTime]);

	return (
		<div
			ref={containerRef}
			className="pointer-events-none absolute inset-0 z-50"
		>
			<div
				ref={playheadLineRef}
				className="pointer-events-none absolute left-0 w-px bg-red-500"
				style={{
					top: 0,
					bottom: 0,
					transform: "translateX(0px)",
					willChange: "transform",
				}}
			/>

			<button
				ref={playheadHandleRef}
				type="button"
				className="cursor-ew pointer-events-auto absolute w-6 bg-transparent outline-none"
				style={{
					top: 0,
					height: timelineHeaderHeight,
					transform: "translateX(-12px)",
					willChange: "transform",
				}}
				onPointerDown={(event) => {
					event.preventDefault();
					if (event.button !== 0) return;

					// Initialize drag state
					const state = dragRef.current;
					state.active = true;
					state.pointerId = event.pointerId;
					state.lastMs = currentTimeRef.current;
					state.pendingMs = currentTimeRef.current;
					state.visualRaf = 0;

					setPlayheadDragging(true);
					event.currentTarget.setPointerCapture?.(event.pointerId);
					updateTime(event.clientX);
				}}
				aria-label="Move playhead"
			>
				<span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-6 flex flex-col items-center">
					<span className="h-3 w-4 rounded bg-red-500 shadow-[0_1px_3px_rgba(0,0,0,0.25)]" />
				</span>
			</button>
		</div>
	);
});
