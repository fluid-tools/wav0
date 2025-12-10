"use client";

import {
	addMarkerAtom,
	horizontalScrollAtom,
	projectEndOverrideAtom,
	projectEndPositionAtom,
	setCurrentTimeAtom,
	timelineAtom,
	timelinePxPerMsAtom,
	timelineWidthAtom,
	useDAWContext,
	useTimebase,
} from "@wav0/daw-react";
import { time } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { MarkerTrack } from "@/components/daw/panels/marker-track";
import { TimelineGridCanvas } from "@/components/daw/panels/timeline-grid-canvas";
import { UnifiedOverlay } from "@/components/daw/unified-overlay";

export function DAWTimeline() {
	const [timeline] = useAtom(timelineAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const daw = useDAWContext();
	const getCurrentTime = useEffectEvent(
		() => daw?.getTransport().getCurrentTime() ?? 0,
	);
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [_projectEndOverride, setProjectEndOverride] = useAtom(
		projectEndOverrideAtom,
	);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isDraggingEnd, setIsDraggingEnd] = useState(false);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [_horizontalScroll] = useAtom(horizontalScrollAtom);
	const [, addMarker] = useAtom(addMarkerAtom);
	const { snap } = useTimebase();

	const getTimeFromClientX = useCallback(
		(clientX: number) => {
			if (pxPerMs <= 0) return null;
			const scrollContainer = document.querySelector('[data-daw-timeline-scroll="true"]') as
				| HTMLElement
				| null;
			if (!scrollContainer) return null;

			const rect = scrollContainer.getBoundingClientRect();
			const viewportX = Math.max(0, clientX - rect.left);
			if (!Number.isFinite(viewportX)) return null;

			const rawMs = Math.max(
				0,
				time.pixelToTime(viewportX, pxPerMs, scrollContainer.scrollLeft),
			);
			return timeline.snapToGrid ? snap(rawMs) : rawMs;
		},
		[pxPerMs, snap, timeline.snapToGrid],
	);

	const onMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDraggingEnd || !containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const ms = Math.max(0, Math.round(x / pxPerMs));
			setProjectEndOverride(ms);
		},
		[isDraggingEnd, pxPerMs, setProjectEndOverride],
	);

	useEffect(() => {
		if (!isDraggingEnd) return;
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", () => setIsDraggingEnd(false), {
			once: true,
		});
		return () => {
			document.removeEventListener("mousemove", onMouseMove);
		};
	}, [isDraggingEnd, onMouseMove]);

	const handleTimelineClick = useCallback(
		async (e: React.MouseEvent | React.PointerEvent) => {
			const timeMs = getTimeFromClientX(e.clientX);
			if (timeMs === null) return;
			await setCurrentTime(timeMs);
		},
		[getTimeFromClientX, setCurrentTime],
	);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
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
			const timeMs = Math.max(0, getCurrentTime());
			const snapped = snap(timeMs);
			addMarker({ timeMs: snapped, name: "", color: "#ffffff" });
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [addMarker, snap, getCurrentTime]);

	const onTimelinePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		event.preventDefault();
		handleTimelineClick(event);
	};

	return (
		<div
			ref={containerRef}
			className="h-full w-full relative bg-muted/10"
			style={{ width: timelineWidth }}
		>
			<div className="absolute inset-0 pointer-events-none z-0">
				<TimelineGridCanvas width={timelineWidth} height={400} />
			</div>

			<div className="absolute inset-0 pointer-events-none z-15">
				<UnifiedOverlay />
			</div>

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
						const at = Math.max(0, getCurrentTime());
						const snapped = timeline.snapToGrid ? snap(at) : at;
						setCurrentTime(snapped);
					}
				}}
				onPointerDown={onTimelinePointerDown}
				aria-label="Timeline - click to set playback position"
			/>

			<div className="absolute inset-0 pointer-events-none z-20">
				<div className="pointer-events-auto">
					<MarkerTrack pxPerMs={pxPerMs} width={timelineWidth} />
				</div>
			</div>

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
				onMouseDown={(e) => {
					e.preventDefault();
					e.stopPropagation();
					setIsDraggingEnd(true);
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
		</div>
	);
}
