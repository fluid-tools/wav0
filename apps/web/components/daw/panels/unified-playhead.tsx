"use client";

import {
	horizontalScrollAtom,
	playbackAtom,
	playheadDraggingAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
	useTimebase,
} from "@wav0/daw-react";
import { time } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { memo, useCallback, useLayoutEffect, useRef } from "react";

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
	const [playback] = useAtom(playbackAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const [timeline] = useAtom(timelineAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, setPlayheadDragging] = useAtom(playheadDraggingAtom);

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

	// Sync visual position from React state (when NOT dragging)
	useLayoutEffect(() => {
		// Skip if dragging - drag handles its own visual updates
		if (dragRef.current.active) return;

		// Inline update using current props (needed for deps)
		if (!playheadLineRef.current || !playheadHandleRef.current) return;
		const playheadX = Math.round(time.timeToPixel(playback.currentTime, pxPerMs, horizontalScroll));
		playheadLineRef.current.style.transform = `translateX(${playheadX}px)`;
		playheadHandleRef.current.style.transform = `translateX(${playheadX - 12}px)`;
	}, [playback.currentTime, pxPerMs, horizontalScroll]);

	// Calculate time from pointer position
	const getTimeFromPointer = useCallback((clientX: number): number | null => {
		const { pxPerMs: px, horizontalScroll: scroll, snapToGrid } = metricsRef.current;
		if (px <= 0) return null;

		const timelineScrollContainer = document.querySelector(
			'[data-daw-timeline-scroll="true"]',
		) as HTMLElement | null;
		if (!timelineScrollContainer) return null;

		const timelineElement =
			timelineScrollContainer.firstElementChild as HTMLElement | null;
		if (!timelineElement) return null;

		const rect = timelineElement.getBoundingClientRect();
		const absoluteX = Math.max(0, clientX - rect.left);
		if (!Number.isFinite(absoluteX)) return null;

		const rawMs = Math.max(0, time.pixelToTime(absoluteX, px, scroll));
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
		if (state.active && state.pendingMs !== playback.currentTime) {
			setCurrentTime(state.pendingMs);
		}

		// Reset drag state
		state.active = false;
		state.pointerId = null;
		state.lastMs = 0;
		state.pendingMs = 0;

		setPlayheadDragging(false);
	}, [setCurrentTime, setPlayheadDragging, playback.currentTime]);

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
					state.lastMs = playback.currentTime;
					state.pendingMs = playback.currentTime;
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
