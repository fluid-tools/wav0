"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
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

export function UnifiedOverlay() {
	const [playheadViewport] = useAtom(playheadViewportAtom);
	const [projectEndX] = useAtom(projectEndViewportPxAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [timeline] = useAtom(timelineAtom);
	const [playback] = useAtom(playbackAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, setPlayheadDragging] = useAtom(playheadDraggingAtom);
	const containerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{
		active: boolean;
		pointerId: number | null;
		lastMs: number;
		lastTs: number;
		pendingMs: number;
		raf: number;
	} | null>(null);

	// Re-render on resize to ensure full-height
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => {});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const snapConfig = useMemo(() => {
		if (!timeline.snapToGrid) return null;
		const bpm = Math.max(30, Math.min(300, playback.bpm || 120));
		const secondsPerBeat = 60 / bpm;
		return secondsPerBeat / 4;
	}, [playback.bpm, timeline.snapToGrid]);

	const updateTime = useCallback(
		(clientX: number, timeStamp?: number) => {
			if (!containerRef.current || pxPerMs <= 0) return;
			const rect = containerRef.current.getBoundingClientRect();
			const localX = clientX - rect.left;
			const absoluteX = Math.max(0, localX + horizontalScroll);
			if (!Number.isFinite(absoluteX)) return;

			const rawMs = Math.max(0, absoluteX / pxPerMs);
			let nextMs = rawMs;

			if (snapConfig) {
				const snappedSeconds =
					Math.round(rawMs / 1000 / snapConfig) * snapConfig;
				nextMs = Math.max(0, snappedSeconds * 1000);
			}

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
		[horizontalScroll, pxPerMs, setCurrentTime, snapConfig],
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
			className="pointer-events-none absolute inset-0 z-50"
		>
			<button
				type="button"
				className="cursor-ew pointer-events-auto absolute top-0 bottom-0 w-6 -translate-x-1/2 bg-transparent outline-none"
				style={{
					transform: `translate3d(${playheadViewport.viewportPx}px,0,0) translateX(-50%)`,
					willChange: "transform",
					WebkitTransform: `translate3d(${playheadViewport.viewportPx}px,0,0) translateX(-50%)`,
					left: 0,
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
}
