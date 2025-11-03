"use client";

import { TrackGridLines } from "@/components/daw/panels/track-grid-lines";
import { timelineWidthAtom } from "@/lib/daw-sdk";
import { useAtom } from "jotai";
import { memo, useEffect, useRef, useState } from "react";

/**
 * TrackGridCanvas - Renders synchronized grid lines in track content area
 * 
 * Positioned at scroll container level to fill viewport height regardless of:
 * - Vertical scroll position
 * - Track count
 * - Content height
 * 
 * Uses same grid generation logic as timeline header for perfect synchronization.
 * Renders grid lines only (no labels) to avoid double markings.
 */
export const TrackGridCanvas = memo(function TrackGridCanvas() {
	const [timelineWidth] = useAtom(timelineWidthAtom);
	const containerRef = useRef<HTMLDivElement>(null);
	const [viewportHeight, setViewportHeight] = useState(0);

	// Measure viewport height from scroll container
	useEffect(() => {
		const container = containerRef.current?.closest('[data-daw-grid-scroll="true"]');
		if (!container) return;

		const updateHeight = () => {
			setViewportHeight(container.clientHeight);
		};

		updateHeight();
		const resizeObserver = new ResizeObserver(updateHeight);
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	if (viewportHeight === 0) {
		return <div ref={containerRef} className="absolute inset-0 pointer-events-none" />;
	}

	return (
		<div
			ref={containerRef}
			className="pointer-events-none z-0"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: timelineWidth,
				height: viewportHeight,
			}}
		>
			<TrackGridLines width={timelineWidth} height={viewportHeight} />
		</div>
	);
});
