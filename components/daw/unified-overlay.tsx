"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import {
	horizontalScrollAtom,
	playbackAtom,
	playheadViewportPxAtom,
	projectEndViewportPxAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
} from "@/lib/state/daw-store";

export function UnifiedOverlay() {
	const [playheadX] = useAtom(playheadViewportPxAtom);
	const [projectEndX] = useAtom(projectEndViewportPxAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [timeline] = useAtom(timelineAtom);
	const [playback] = useAtom(playbackAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const containerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{
		active: boolean;
		pointerId: number | null;
	} | null>(null);

	// Re-render on resize to ensure full-height
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => {});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const updateTime = useCallback(
		(clientX: number) => {
			if (!containerRef.current || pxPerMs <= 0) return;
			const rect = containerRef.current.getBoundingClientRect();
			const localX = clientX - rect.left;
			const absoluteX = localX + horizontalScroll;
			if (!Number.isFinite(absoluteX)) return;

			const rawMs = Math.max(0, absoluteX / pxPerMs);
			let nextMs = rawMs;

			if (timeline.snapToGrid) {
				const bpm = Math.max(30, Math.min(300, playback.bpm || 120));
				const secondsPerBeat = 60 / bpm;
				const snapSeconds = secondsPerBeat / 4;
				const snappedSeconds =
					Math.round(rawMs / 1000 / snapSeconds) * snapSeconds;
				nextMs = Math.max(0, snappedSeconds * 1000);
			}

			setCurrentTime(nextMs);
		},
		[
			horizontalScroll,
			pxPerMs,
			playback.bpm,
			setCurrentTime,
			timeline.snapToGrid,
		],
	);

	const stopDrag = useCallback(() => {
		const state = dragRef.current;
		if (!state?.active || !containerRef.current) {
			dragRef.current = { active: false, pointerId: null };
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
		dragRef.current = { active: false, pointerId: null };
	}, []);

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			const state = dragRef.current;
			if (!state?.active || state.pointerId !== event.pointerId) return;
			updateTime(event.clientX);
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
					transform: `translate3d(${playheadX}px,0,0) translateX(-50%)`,
					willChange: "transform",
					WebkitTransform: `translate3d(${playheadX}px,0,0) translateX(-50%)`,
					left: 0,
				}}
				onPointerDown={(event) => {
					if (event.button !== 0) return;
					event.preventDefault();
					dragRef.current = { active: true, pointerId: event.pointerId };
					event.currentTarget.setPointerCapture?.(event.pointerId);
					updateTime(event.clientX);
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
