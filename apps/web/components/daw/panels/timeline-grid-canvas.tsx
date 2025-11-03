"use client";
import { time } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { memo, useEffect, useMemo, useRef } from "react";
import {
	cachedTimeGridAtom,
	horizontalScrollAtom,
	timelinePxPerMsAtom,
} from "@/lib/daw-sdk";
import { TimelineGridHeader } from "./timeline-grid-header";

type Props = {
	width: number;
	height: number;
};

export const TimelineGridCanvas = memo(function TimelineGridCanvas({
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

	// Draw grid when dependencies change
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !themeColors) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Draw minor grid lines using unified timeToPixel function
		ctx.strokeStyle = themeColors.minor;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const ms of timeGrid.minors) {
			// Use unified timeToPixel function - same calculation as playhead
			const x = time.timeToPixel(ms, pxPerMs, scrollLeft);
			// Round only at final pixel position for crisp canvas rendering
			const roundedX = Math.round(x);
			if (roundedX >= 0 && roundedX <= width) {
				ctx.moveTo(roundedX, 0);
				ctx.lineTo(roundedX, height);
			}
		}
		ctx.stroke();

		// Draw major grid lines using unified timeToPixel function
		ctx.strokeStyle = themeColors.major;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const marker of timeGrid.majors) {
			// Use unified timeToPixel function - same calculation as playhead
			const x = time.timeToPixel(marker.ms, pxPerMs, scrollLeft);
			// Round only at final pixel position for crisp canvas rendering
			const roundedX = Math.round(x);
			if (roundedX >= 0 && roundedX <= width) {
				ctx.moveTo(roundedX, 0);
				ctx.lineTo(roundedX, height);
			}
		}
		ctx.stroke();
	}, [width, height, pxPerMs, scrollLeft, timeGrid, themeColors]);

	return (
		<div className="relative" style={{ width, height }}>
			<canvas
				ref={canvasRef}
				className="absolute inset-0 pointer-events-none"
				style={{ width, height }}
			/>
			<TimelineGridHeader width={width} height={height} />
		</div>
	);
});
