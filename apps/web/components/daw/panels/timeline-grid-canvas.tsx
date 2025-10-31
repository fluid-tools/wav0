"use client";
import { useAtom } from "jotai";
import { memo, useDeferredValue, useEffect, useMemo, useRef } from "react";
import { cachedTimeGridAtom } from "@/lib/daw-sdk/state/view";
import { TimelineGridHeader } from "./timeline-grid-header";

type Props = {
	width: number;
	height: number;
	pxPerMs: number;
	scrollLeft: number;
};

export const TimelineGridCanvas = memo(function TimelineGridCanvas({
	width,
	height,
	pxPerMs,
	scrollLeft,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Use deferred values for smooth high-frequency updates
	const deferredPxPerMs = useDeferredValue(pxPerMs);
	const deferredScrollLeft = useDeferredValue(scrollLeft);

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

		// Draw minor grid lines
		ctx.strokeStyle = themeColors.minor;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const ms of timeGrid.minors) {
			const x = ms * deferredPxPerMs - deferredScrollLeft;
			if (x >= 0 && x <= width) {
				ctx.moveTo(x, 0);
				ctx.lineTo(x, height);
			}
		}
		ctx.stroke();

		// Draw major grid lines
		ctx.strokeStyle = themeColors.major;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const marker of timeGrid.majors) {
			const x = marker.ms * deferredPxPerMs - deferredScrollLeft;
			if (x >= 0 && x <= width) {
				ctx.moveTo(x, 0);
				ctx.lineTo(x, height);
			}
		}
		ctx.stroke();
	}, [
		width,
		height,
		deferredPxPerMs,
		deferredScrollLeft,
		timeGrid,
		themeColors,
	]);

	return (
		<div className="relative" style={{ width, height }}>
			<canvas
				ref={canvasRef}
				className="absolute inset-0 pointer-events-none"
				style={{ width, height }}
			/>
			<TimelineGridHeader
				width={width}
				height={height}
				pxPerMs={deferredPxPerMs}
				scrollLeft={deferredScrollLeft}
			/>
		</div>
	);
});
