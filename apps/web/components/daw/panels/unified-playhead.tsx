"use client";

import { useAtom } from "jotai";
import { memo, useRef, useLayoutEffect, useCallback } from "react";
import {
	horizontalScrollAtom,
	playbackAtom,
	playheadDraggingAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
} from "@/lib/daw-sdk";
import { useTimebase } from "@/lib/daw-sdk/hooks/use-timebase";
import { time } from "@wav0/daw-sdk";
import { DAW_HEIGHTS } from "@/lib/constants/daw-design";

type Props = {
	timelineHeaderHeight: number;
};

/**
 * UnifiedPlayhead - Single playhead that spans both timeline header and track content
 *
 * This is the Logic Pro style approach: one continuous vertical line from timeline
 * ruler down through all tracks, with a draggable handle at the top.
 *
 * Positioned absolutely at the panel level to avoid split playhead issues.
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

	const dragRef = useRef<{
		active: boolean;
		pointerId: number | null;
		lastMs: number;
		pendingMs: number;
		raf: number;
	} | null>(null);

	const { snap } = useTimebase();

	// Update playhead position synchronously before paint
	useLayoutEffect(() => {
		if (!playheadLineRef.current || !playheadHandleRef.current) return;

		// Calculate position using unified timeToPixel function
		const playheadX = Math.round(
			time.timeToPixel(playback.currentTime, pxPerMs, horizontalScroll)
		);

		// Apply transform directly to DOM for frame-perfect sync
		playheadLineRef.current.style.transform = `translateX(${playheadX}px)`;
		playheadHandleRef.current.style.transform = `translateX(${playheadX - 12}px)`;
	}, [playback.currentTime, pxPerMs, horizontalScroll]);

	const updateTime = useCallback(
		(clientX: number, timeStamp?: number) => {
			if (!containerRef.current || pxPerMs <= 0) return;

			// IMPORTANT: UnifiedPlayhead is OUTSIDE scroll containers at panel level
			// The timeline scroll container is a sibling's child, not an ancestor
			// Use querySelector to find it reliably
			const timelineScrollContainer = document.querySelector('[data-daw-timeline-scroll="true"]') as HTMLElement | null;
			if (!timelineScrollContainer) return;

			// Get the timeline content element (first child of scroll container)
			const timelineElement = timelineScrollContainer.firstElementChild as HTMLElement | null;
			if (!timelineElement) return;

			const rect = timelineElement.getBoundingClientRect();
			// clientX - rect.left gives us position in timeline coordinates
			// rect.left is negative when scrolled, so this automatically accounts for scroll
			const absoluteX = Math.max(0, clientX - rect.left);
			if (!Number.isFinite(absoluteX)) return;

			const rawMs = Math.max(0, absoluteX / pxPerMs);
			const nextMs = timeline.snapToGrid ? snap(rawMs) : rawMs;

			const state = dragRef.current;
			if (!state?.active) {
				setCurrentTime(nextMs);
				return;
			}

			state.lastMs = nextMs;
			state.pendingMs = nextMs;
			if (!state.raf) {
				state.raf = requestAnimationFrame(() => {
					const current = dragRef.current;
					if (!current) return;
					const value = current.pendingMs;
					current.raf = 0;
					setCurrentTime(value);
				});
			}
		},
		[pxPerMs, setCurrentTime, timeline.snapToGrid, snap],
	);

	const stopDrag = useCallback(() => {
		const state = dragRef.current;
		if (!state?.active || !playheadHandleRef.current) {
			dragRef.current = {
				active: false,
				pointerId: null,
				lastMs: 0,
				pendingMs: 0,
				raf: 0,
			};
			setPlayheadDragging(false);
			return;
		}
		const element = playheadHandleRef.current;
		const pointerId = state.pointerId;
		if (pointerId !== null && element.hasPointerCapture?.(pointerId)) {
			try {
				element.releasePointerCapture(pointerId);
			} catch {
				// Ignore capture release failures
			}
		}
		if (state.raf) {
			cancelAnimationFrame(state.raf);
			state.raf = 0;
		}
		setCurrentTime(state.pendingMs);
		dragRef.current = {
			active: false,
			pointerId: null,
			lastMs: 0,
			pendingMs: 0,
			raf: 0,
		};
		setPlayheadDragging(false);
	}, [setCurrentTime, setPlayheadDragging]);

	// Handle pointer events for dragging
	useLayoutEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			const state = dragRef.current;
			if (!state?.active || state.pointerId !== event.pointerId) return;
			updateTime(event.clientX, event.timeStamp);
		};

		const handlePointerUp = (event: PointerEvent) => {
			const state = dragRef.current;
			if (!state?.active || state.pointerId !== event.pointerId) return;
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
			{/* Playhead line - spans from timeline header through track content */}
			<div
				ref={playheadLineRef}
				className="pointer-events-none absolute left-0 w-px bg-red-500"
				style={{
					top: 0,
					bottom: 0,
					transform: "translateX(0px)", // Initial position (updated by layoutEffect)
					willChange: "transform",
				}}
			/>

			{/* Draggable handle - positioned at top in timeline header area */}
			<button
				ref={playheadHandleRef}
				type="button"
				className="cursor-ew pointer-events-auto absolute w-6 bg-transparent outline-none"
				style={{
					top: 0,
					height: timelineHeaderHeight,
					transform: "translateX(-12px)", // Initial position (updated by layoutEffect)
					willChange: "transform",
				}}
				onPointerDown={(event) => {
					event.preventDefault();
					if (event.button !== 0) return;
					dragRef.current = {
						active: true,
						pointerId: event.pointerId,
						lastMs: playback.currentTime,
						pendingMs: playback.currentTime,
						raf: 0,
					};
					setPlayheadDragging(true);
					event.currentTarget.setPointerCapture?.(event.pointerId);
					updateTime(event.clientX, event.timeStamp);
				}}
				aria-label="Move playhead"
			>
				{/* Visible handle indicator at top */}
				<span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-6 flex flex-col items-center">
					<span className="h-3 w-4 rounded bg-red-500 shadow-[0_1px_3px_rgba(0,0,0,0.25)]" />
				</span>
			</button>
		</div>
	);
});
