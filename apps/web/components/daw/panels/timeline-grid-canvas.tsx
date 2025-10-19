"use client";
import { useEffect, useRef } from "react";
import { useTimebase } from "@/lib/daw-sdk/hooks/use-timebase";

type Props = {
	width: number;
	height: number;
	pxPerMs: number;
	scrollLeft: number;
	bpm: number;
	signature: { num: number; den: number };
	resolution: "1/1" | "1/2" | "1/4" | "1/8" | "1/16";
	triplet: boolean;
	swing: number;
};

export function TimelineGridCanvas({
	width,
	height,
	pxPerMs,
	scrollLeft,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const timebase = useTimebase();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.max(1, Math.floor(width * dpr));
		canvas.height = Math.max(1, Math.floor(height * dpr));
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		ctx.clearRect(0, 0, width, height);

		const viewStartMs = scrollLeft / pxPerMs;
		const viewEndMs = (scrollLeft + width) / pxPerMs;
		const grid = timebase.getGridSubdivisionsInView(viewStartMs, viewEndMs, pxPerMs);

		// Resolve theme colors from CSS variables to avoid black-on-black
		const styles = getComputedStyle(canvas);
		const colSub = styles.getPropertyValue("--timeline-grid-sub").trim() || "rgba(255,255,255,0.15)";
		const colBeat = styles.getPropertyValue("--timeline-grid-beat").trim() || "rgba(255,255,255,0.3)";
		const colMeas = styles.getPropertyValue("--timeline-grid-measure").trim() || "rgba(255,255,255,0.5)";
		const colLabel = styles.getPropertyValue("--timeline-grid-label").trim() || "rgba(255,255,255,0.7)";

		// Draw subdivisions (thin lines)
		ctx.strokeStyle = colSub;
		ctx.lineWidth = 0.5;
		for (const ms of grid.subs) {
			const x = ms * pxPerMs - scrollLeft;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}

		// Draw beats (1px; heavier stroke if primary)
		ctx.strokeStyle = colBeat;
		ctx.lineWidth = 1;
		for (const beat of grid.beats) {
			const x = beat.ms * pxPerMs - scrollLeft;
			ctx.lineWidth = beat.primary ? 1.5 : 1;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}

		// Draw measures + labels (2px)
		ctx.strokeStyle = colMeas;
		ctx.lineWidth = 2;
		ctx.fillStyle = colLabel;
		ctx.font = "10px monospace";
		let lastLabelX = -1e9;
		const minLabelSpacing = 28; // px
		for (const measure of grid.measures) {
			const x = measure.ms * pxPerMs - scrollLeft;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
			if (x - lastLabelX >= minLabelSpacing && x >= 0 && x <= width) {
				ctx.fillText(`${measure.bar}`, x + 4, 12);
				lastLabelX = x;
			}
		}
	}, [width, height, pxPerMs, scrollLeft, timebase]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none"
			style={{ width, height }}
		/>
	);
}
