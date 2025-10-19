"use client";
import { useEffect, useRef } from "react";
import { enumerateGrid, msToBarsBeats } from "@/lib/daw-sdk/utils/time-utils";

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
	bpm,
	signature,
	resolution,
	triplet,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		ctx.scale(dpr, dpr);

		ctx.clearRect(0, 0, width, height);

		const viewStartMs = scrollLeft / pxPerMs;
		const viewEndMs = (scrollLeft + width) / pxPerMs;
		const grid = enumerateGrid(
			viewStartMs,
			viewEndMs,
			bpm,
			signature,
			resolution,
			triplet,
		);

		// Draw subdivisions
		ctx.strokeStyle = "var(--timeline-grid-sub)";
		ctx.lineWidth = 0.5;
		for (const ms of grid.subs) {
			const x = ms * pxPerMs - scrollLeft;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}

		// Draw beats
		ctx.strokeStyle = "var(--timeline-grid-beat)";
		ctx.lineWidth = 1;
		for (const ms of grid.beats) {
			const x = ms * pxPerMs - scrollLeft;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}

		// Draw measures + labels
		ctx.strokeStyle = "var(--timeline-grid-measure)";
		ctx.lineWidth = 2;
		ctx.fillStyle = "var(--timeline-grid-label)";
		ctx.font = "10px monospace";
		for (const ms of grid.measures) {
			const x = ms * pxPerMs - scrollLeft;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
			const { bar } = msToBarsBeats(ms, bpm, signature);
			ctx.fillText(`${bar}`, x + 4, 12);
		}
	}, [width, height, pxPerMs, scrollLeft, bpm, signature, resolution, triplet]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none"
			style={{ width, height }}
		/>
	);
}
