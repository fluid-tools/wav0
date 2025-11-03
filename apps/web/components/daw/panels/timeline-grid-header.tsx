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

export function TimelineGridHeader({ width, height }: Props) {
	const [timeGrid] = useAtom(cachedTimeGridAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [scrollLeft] = useAtom(horizontalScrollAtom);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !timeGrid.majors.length) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.clearRect(0, 0, width, height);

		ctx.font = "10px monospace";
		ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--timeline-grid-label").trim() || "rgba(255,255,255,0.7)";
		ctx.textBaseline = "top";

		const viewportStart = scrollLeft / pxPerMs;
		const viewportEnd = (scrollLeft + width) / pxPerMs;

		let lastLabelX = -1e9;
		const minLabelSpacing = 28;

		for (const marker of timeGrid.majors) {
			if (marker.ms < viewportStart || marker.ms > viewportEnd) continue;

			const x = Math.round(marker.ms * pxPerMs);

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
