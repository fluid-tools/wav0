"use client";
import { time } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { useLayoutEffect, useRef } from "react";
import {
	cachedTimeGridAtom,
	horizontalScrollAtom,
	timelinePxPerMsAtom,
} from "@/lib/daw-sdk";

type Props = {
	width: number;
	height: number;
};

/**
 * TimelineGridHeader - Renders timestamp labels on canvas
 *
 * Uses canvas rendering with layoutEffect to ensure perfect sync with grid lines.
 * This eliminates the React render cycle lag that caused labels to desync during scroll.
 */
export function TimelineGridHeader({ width, height }: Props) {
	const [timeGrid] = useAtom(cachedTimeGridAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [scrollLeft] = useAtom(horizontalScrollAtom);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Draw labels synchronously before browser paint using layoutEffect
	// This ensures labels stay perfectly in sync with grid lines and playhead
	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !timeGrid.majors.length) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Configure text rendering
		ctx.font = "10px monospace";
		ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--timeline-grid-label").trim() || "rgba(255,255,255,0.7)";
		ctx.textBaseline = "top";

		// IMPORTANT: Canvas is INSIDE scroll container, so use ABSOLUTE timeline coordinates
		// Do NOT subtract scrollLeft - the browser handles scrolling
		const viewportStart = scrollLeft / pxPerMs;
		const viewportEnd = (scrollLeft + width) / pxPerMs;

		let lastLabelX = -1e9;
		const minLabelSpacing = 28; // px

		for (const marker of timeGrid.majors) {
			// Skip markers outside viewport
			if (marker.ms < viewportStart || marker.ms > viewportEnd) continue;

			// Use absolute timeline position (browser will scroll it)
			const x = Math.round(marker.ms * pxPerMs);

			// Only render labels that have enough spacing
			if (x - lastLabelX >= minLabelSpacing) {
				ctx.fillText(marker.label, x + 4, 2);
				lastLabelX = x;
			}
		}
	}, [timeGrid.majors, pxPerMs, scrollLeft, width, height]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none"
			width={width}
			height={height}
			style={{ width, height }}
			aria-label="Timeline grid labels"
		/>
	);
}
