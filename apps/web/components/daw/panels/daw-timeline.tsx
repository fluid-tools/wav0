"use client";

import { useAtom } from "jotai";
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";
import { MarkerTrack } from "@/components/daw/panels/marker-track";
import { TimelineGridCanvas } from "@/components/daw/panels/timeline-grid-canvas";
import {
	addMarkerAtom,
	gridAtom,
	horizontalScrollAtom,
	musicalMetadataAtom,
	playbackAtom,
	playheadViewportPxAtom,
	projectEndOverrideAtom,
	projectEndPositionAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
	timelineWidthAtom,
} from "@/lib/daw-sdk";
import { useTimebase } from "@/lib/daw-sdk/hooks/use-timebase";
import {
	alignHairline,
	clientXToMs,
	msToViewportPx,
	type Scale,
} from "@/lib/daw-sdk/utils/scale";
import { calculateTimeMarkers } from "@/lib/daw-sdk/utils/time-utils";

export function DAWTimeline() {
	const [timeline] = useAtom(timelineAtom);
	const [playback] = useAtom(playbackAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [_projectEndOverride, setProjectEndOverride] = useAtom(
		projectEndOverrideAtom,
	);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isDraggingEnd, setIsDraggingEnd] = useState(false);
	const [playheadViewportPx] = useAtom(playheadViewportPxAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [, addMarker] = useAtom(addMarkerAtom);
	const [grid] = useAtom(gridAtom);
	const [music] = useAtom(musicalMetadataAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const { grid: tGrid } = useTimebase();

	// legacy marker drag removed in favor of dedicated MarkerTrack

	// Project end drag state and helpers with live refs
	const dragRef = useRef<{
		active: boolean;
		pointerId: number | null;
		raf: number;
		lastClientX: number;
	}>({ active: false, pointerId: null, raf: 0, lastClientX: 0 });

	const edgeScrollRef = useRef<{ raf: number; velocity: number } | null>(null);

	// Live refs to avoid stale closures during RAF
	const scrollLeftRef = useRef(horizontalScroll);
	const pxPerMsRef = useRef(pxPerMs);
	const snapConfigRef = useRef<{
		secondsPerBeat: number;
		snapSeconds: number;
	} | null>(null);

	// Keep refs in sync
	useEffect(() => {
		scrollLeftRef.current = horizontalScroll;
	}, [horizontalScroll]);

	useEffect(() => {
		pxPerMsRef.current = pxPerMs;
	}, [pxPerMs]);

	useEffect(() => {
		if (timeline.snapToGrid) {
			const secondsPerBeat = 60 / playback.bpm;
			snapConfigRef.current = {
				secondsPerBeat,
				snapSeconds: secondsPerBeat / 4,
			};
		} else {
			snapConfigRef.current = null;
		}
	}, [timeline.snapToGrid, playback.bpm]);

	const dispatchScrollLeft = (left: number) => {
		window.dispatchEvent(
			new CustomEvent("wav0:grid-scroll-request", { detail: { left } }),
		);
	};

	// Unified drag tick that reads from live refs
	const dragTick = useCallback(() => {
		const s = dragRef.current;
		if (!s.active || !containerRef.current) return;

		const scale: Scale = {
			pxPerMs: pxPerMsRef.current,
			scrollLeft: scrollLeftRef.current,
		};
		let nextMs = clientXToMs(
			s.lastClientX,
			containerRef.current.getBoundingClientRect().left,
			scale,
		);

		if (snapConfigRef.current) {
			const snappedSeconds =
				Math.round(nextMs / 1000 / snapConfigRef.current.snapSeconds) *
				snapConfigRef.current.snapSeconds;
			nextMs = Math.max(0, snappedSeconds * 1000);
		}

		setProjectEndOverride(Math.max(0, Math.round(nextMs)));
		s.raf = requestAnimationFrame(dragTick);
	}, [setProjectEndOverride]);

	const onDragPointerMove = useEffectEvent((...args: unknown[]) => {
		const e = args[0] as PointerEvent;
		const s = dragRef.current;
		if (!s.active || s.pointerId !== e.pointerId) return;
		s.lastClientX = e.clientX;

		// Edge autoscroll: within 32px of edges
		const el = containerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const zone = 32;
		let velocity = 0;
		if (e.clientX - rect.left < zone) {
			const t = 1 - (e.clientX - rect.left) / zone; // 0..1
			velocity = -Math.max(2, Math.floor(t * 20));
		} else if (rect.right - e.clientX < zone) {
			const t = 1 - (rect.right - e.clientX) / zone;
			velocity = Math.max(2, Math.floor(t * 20));
		}
		if (velocity === 0) {
			if (edgeScrollRef.current?.raf) {
				cancelAnimationFrame(edgeScrollRef.current.raf);
				edgeScrollRef.current = null;
			}
		} else {
			// Start/refresh autoscroll loop (separate from dragTick)
			if (!edgeScrollRef.current) edgeScrollRef.current = { raf: 0, velocity };
			edgeScrollRef.current.velocity = velocity;
			if (!edgeScrollRef.current.raf) {
				const tick = () => {
					const st = edgeScrollRef.current;
					if (!st) return;
					const nextLeft = Math.max(0, scrollLeftRef.current + st.velocity);
					scrollLeftRef.current = nextLeft; // Update ref immediately
					dispatchScrollLeft(nextLeft);
					st.raf = requestAnimationFrame(tick);
				};
				edgeScrollRef.current.raf = requestAnimationFrame(tick);
			}
		}
	});

	const onDragPointerUp = useEffectEvent((...args: unknown[]) => {
		const e = args[0] as PointerEvent;
		const s = dragRef.current;
		if (!s.active || s.pointerId !== e.pointerId) return;
		if (s.raf) cancelAnimationFrame(s.raf);
		dragRef.current = {
			active: false,
			pointerId: null,
			raf: 0,
			lastClientX: 0,
		};
		setIsDraggingEnd(false);
		if (edgeScrollRef.current?.raf)
			cancelAnimationFrame(edgeScrollRef.current.raf);
		edgeScrollRef.current = null;
	});

	useEffect(() => {
		window.addEventListener("pointermove", onDragPointerMove as EventListener);
		window.addEventListener("pointerup", onDragPointerUp as EventListener);
		window.addEventListener("pointercancel", onDragPointerUp as EventListener);
		return () => {
			window.removeEventListener(
				"pointermove",
				onDragPointerMove as EventListener,
			);
			window.removeEventListener("pointerup", onDragPointerUp as EventListener);
			window.removeEventListener(
				"pointercancel",
				onDragPointerUp as EventListener,
			);
		};
	}, [onDragPointerMove, onDragPointerUp]);
	const _timelinePlayheadViewport = playheadViewportPx;

	// Calculate time markers (time mode) - use centralized helper
	const timeMarkers = calculateTimeMarkers(
		timelineWidth,
		pxPerMs,
		timeline.zoom,
	);

	// Beat markers computation removed; canvas grid handles bars mode

	const { snap } = useTimebase();

	const handleTimelineClick = (e: React.MouseEvent | React.PointerEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		if (pxPerMs <= 0) return;

		const scale: Scale = { pxPerMs, scrollLeft: horizontalScroll };
		let time = clientXToMs(e.clientX, rect.left, scale);

		// Apply snapping only when snap-to-grid is enabled
		if (timeline.snapToGrid) {
			time = snap(time);
		}

		setCurrentTime(Math.max(0, time));
	};

	// Add marker at playhead on key "m"
	const onKey = useEffectEvent((...args: unknown[]) => {
		const e = args[0] as KeyboardEvent;
		// Ignore if typing in an input or if modifier keys are pressed
		const target = e.target as HTMLElement;
		if (
			target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.tagName === "SELECT" ||
			target.isContentEditable ||
			e.metaKey ||
			e.ctrlKey ||
			e.altKey ||
			e.shiftKey
		) {
			return;
		}
		if (e.key.toLowerCase() !== "m") return;
		const timeMs = Math.max(0, playback.currentTime);
		const snapped = snap(timeMs);
		addMarker({ timeMs: snapped, name: "", color: "#ffffff" });
	});
	useEffect(() => {
		window.addEventListener("keydown", onKey as EventListener);
		return () => window.removeEventListener("keydown", onKey as EventListener);
	}, [onKey]);

	const onTimelinePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		event.preventDefault();
		handleTimelineClick(event);
	};

	// Playhead position calculation (now handled by DAWPlayhead component)

	return (
		<div
			ref={containerRef}
			className="h-full w-full relative bg-muted/10"
			style={{ width: timelineWidth }}
		>
			{/* Visual layer - non-interactive */}
			<div className="absolute inset-0 pointer-events-none z-0">
				{tGrid.mode === "bars" ? (
					<TimelineGridCanvas
						width={timelineWidth}
						height={400}
						pxPerMs={pxPerMs}
						scrollLeft={horizontalScroll}
					/>
				) : (
					timeMarkers.map((marker) => {
						const scale: Scale = { pxPerMs, scrollLeft: horizontalScroll };
						const viewportX = msToViewportPx(marker.time, scale);
						return (
							<div
								key={`time-${marker.time}`}
								className="absolute top-0"
								style={{ left: alignHairline(viewportX) }}
							>
								<div className="w-px h-3 bg-foreground" />
								<span className="text-xs text-muted-foreground ml-1 font-mono">
									{marker.label}
								</span>
							</div>
						);
					})
				)}
			</div>

			{/* Timeline click layer - interactive background */}
			{/* biome-ignore lint/a11y/useSemanticElements: Cannot use button element as it would create nested interactive elements with MarkerTrack buttons and project end slider */}
			<div
				className="absolute inset-0 cursor-pointer z-10"
				role="button"
				tabIndex={0}
				onClick={(e) => {
					if (isDraggingEnd) return;
					handleTimelineClick(e);
				}}
				onKeyDown={(e) => {
					if (isDraggingEnd) return;
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						const at = Math.max(0, playback.currentTime);
						const snapped = timeline.snapToGrid ? snap(at) : at;
						setCurrentTime(snapped);
					}
				}}
				onPointerDown={onTimelinePointerDown}
				aria-label="Timeline - click to set playback position"
			/>

			{/* Markers layer - higher priority */}
			<div className="absolute inset-0 pointer-events-none z-20">
				<div className="pointer-events-auto">
					<MarkerTrack pxPerMs={pxPerMs} width={timelineWidth} />
				</div>
			</div>

			{/* Project end slider - highest priority */}
			<div
				className="absolute top-0 bottom-0 w-px bg-yellow-500/70 z-30 pointer-events-auto"
				style={{
					left: projectEndPosition,
					cursor: "ew-resize",
				}}
				tabIndex={0}
				title="Project End"
				role="slider"
				aria-label="Project end"
				aria-valuemin={0}
				aria-valuenow={Math.max(0, Math.round(projectEndPosition))}
				onPointerDown={(e) => {
					e.preventDefault();
					e.stopPropagation();
					setIsDraggingEnd(true);
					dragRef.current.active = true;
					dragRef.current.pointerId = e.pointerId;
					(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
					dragRef.current.lastClientX = e.clientX;
					// Start the unified drag tick loop
					dragRef.current.raf = requestAnimationFrame(dragTick);
				}}
			/>

			{/* Buffer/dead space overlay */}
			<div
				className="absolute top-0 bottom-0 bg-muted/20 pointer-events-none z-20"
				style={{
					left: projectEndPosition,
					right: 0,
				}}
			/>

			{/* Playhead is rendered in UnifiedOverlay to keep header + grid perfectly synchronized */}

			{/* Snap grid overlay */}
			{timeline.snapToGrid && (
				<div className="absolute inset-0 pointer-events-none z-5">
					{Array.from({ length: Math.ceil(timelineWidth / 25) }).map((_, i) => (
						<div
							key={`snap-grid-${i * 25}`}
							className="absolute top-0 bottom-0 w-px bg-primary/10"
							style={{ left: i * 25 }}
						/>
					))}
				</div>
			)}
		</div>
	);
}
