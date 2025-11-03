"use client";

import { time } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
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
 * TrackGridLines - Renders grid lines only (no labels)
 *
 * Used in track content area where labels are not needed.
 * Extracted from TimelineGridCanvas without TimelineGridHeader.
 */
export const TrackGridLines = memo(function TrackGridLines({
	width,
	height,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Use immediate values for real-time sync with playhead
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [scrollLeft] = useAtom(horizontalScrollAtom);

	// Use cached time grid atom
	const timeGrid = useAtom(cachedTimeGridAtom)[0];

	// Memoize theme colors to avoid repeated getComputedStyle calls
	const themeColors = useMemo(() => {
		if (!canvasRef.current) return null;

		const styles = getComputedStyle(canvasRef.current);
		return {
			minor:
				styles.getPropertyValue("--timeline-grid-minor").trim() ||
				"rgba(255,255,255,0.15)",
			major:
				styles.getPropertyValue("--timeline-grid-major").trim() ||
				"rgba(255,255,255,0.4)",
		};
	}, []); // Only compute once on mount

	// Draw grid synchronously before browser paint using layoutEffect
	// This ensures grid lines stay perfectly in sync with timeline header grid and playhead
	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !themeColors) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// IMPORTANT: Canvas is INSIDE scroll container, so use ABSOLUTE timeline coordinates
		// Do NOT subtract scrollLeft - the browser handles scrolling
		// Only draw markers visible in current viewport for performance
		const viewportStart = scrollLeft / pxPerMs;
		const viewportEnd = (scrollLeft + width) / pxPerMs;

		// Draw minor grid lines
		ctx.strokeStyle = themeColors.minor;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const ms of timeGrid.minors) {
			// Skip markers outside viewport
			if (ms < viewportStart || ms > viewportEnd) continue;

			// Use absolute timeline position (browser will scroll it)
			const x = Math.round(ms * pxPerMs);
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
		}
		ctx.stroke();

		// Draw major grid lines
		ctx.strokeStyle = themeColors.major;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const marker of timeGrid.majors) {
			// Skip markers outside viewport
			if (marker.ms < viewportStart || marker.ms > viewportEnd) continue;

			// Use absolute timeline position (browser will scroll it)
			const x = Math.round(marker.ms * pxPerMs);
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
		}
		ctx.stroke();
	}, [width, height, pxPerMs, scrollLeft, timeGrid, themeColors]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none"
			style={{ width, height }}
		/>
	);
});
