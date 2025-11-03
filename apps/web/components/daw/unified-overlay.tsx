"use client";

import { useAtom } from "jotai";
import { memo, useCallback, useEffect, useRef } from "react";
import {
	horizontalScrollAtom,
	playbackAtom,
	playheadDraggingAtom,
	playheadViewportAtom,
	projectEndViewportPxAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
} from "@/lib/daw-sdk";
import { useTimebase } from "@/lib/daw-sdk/hooks/use-timebase";
import { time } from "@wav0/daw-sdk";

export const UnifiedOverlay = memo(function UnifiedOverlay() {
	const [projectEndX] = useAtom(projectEndViewportPxAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [timeline] = useAtom(timelineAtom);
	const [playback] = useAtom(playbackAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, setPlayheadDragging] = useAtom(playheadDraggingAtom);
	
	// Calculate playhead position using same logic as grid markers for perfect alignment
	// Round only at final pixel position, matching TimelineGridCanvas behavior
	const playheadX = Math.round(
		time.timeToPixel(playback.currentTime, pxPerMs, horizontalScroll)
	);
	const containerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{
		active: boolean;
		pointerId: number | null;
		lastMs: number;
		lastTs: number;
		pendingMs: number;
		raf: number;
	} | null>(null);

	// Use unified snap logic from useTimebase
	const { snap } = useTimebase();

	const updateTime = useCallback(
		(clientX: number, timeStamp?: number) => {
			if (!containerRef.current || pxPerMs <= 0) return;
			const rect = containerRef.current.getBoundingClientRect();
			const localX = clientX - rect.left;
			// localX is viewport position relative to DAWTimeline's visible left edge
			// Add horizontalScroll to get absolute timeline position
			const absoluteX = Math.max(0, localX + horizontalScroll);
			if (!Number.isFinite(absoluteX)) return;

			const rawMs = Math.max(0, absoluteX / pxPerMs);
			const nextMs = timeline.snapToGrid ? snap(rawMs) : rawMs;

			const state = dragRef.current;
			if (!state?.active) {
				setCurrentTime(nextMs);
				return;
			}

			state.lastMs = nextMs;
			state.lastTs = timeStamp ?? performance.now();
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
		[pxPerMs, horizontalScroll, setCurrentTime, timeline.snapToGrid, snap],
	);

	const stopDrag = useCallback(() => {
		const state = dragRef.current;
		if (!state?.active || !containerRef.current) {
			dragRef.current = {
				active: false,
				pointerId: null,
				lastMs: 0,
				lastTs: 0,
				pendingMs: 0,
				raf: 0,
			};
			setPlayheadDragging(false);
			return;
		}
		const element = containerRef.current;
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
			lastTs: 0,
			pendingMs: 0,
			raf: 0,
		};
		setPlayheadDragging(false);
	}, [setCurrentTime, setPlayheadDragging]);

	useEffect(() => {
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
			className="pointer-events-none absolute inset-0"
		>
			<button
				type="button"
				className="cursor-ew pointer-events-auto absolute top-0 bottom-0 w-6 bg-transparent outline-none"
				style={{
					left: `${playheadX - 12}px`,
					willChange: "left",
				}}
				onPointerDown={(event) => {
					event.preventDefault();
					if (event.button !== 0) return;
					dragRef.current = {
						active: true,
						pointerId: event.pointerId,
						lastMs: playback.currentTime,
						lastTs: event.timeStamp,
						pendingMs: playback.currentTime,
						raf: 0,
					};
					setPlayheadDragging(true);
					event.currentTarget.setPointerCapture?.(event.pointerId);
					updateTime(event.clientX, event.timeStamp);
				}}
				aria-label="Move playhead"
			>
				<span className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-red-500" />
				<span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-6 flex flex-col items-center">
					<span className="h-3 w-4 rounded bg-red-500 shadow-[0_1px_3px_rgba(0,0,0,0.25)]" />
				</span>
			</button>
			<div
				className="pointer-events-none absolute top-0 bottom-0 w-px bg-yellow-500/70"
				style={{ left: projectEndX }}
			/>
		</div>
	);
});
