"use client";

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

export const TrackGridLines = memo(function TrackGridLines({
	width,
	height,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [scrollLeft] = useAtom(horizontalScrollAtom);

	const timeGrid = useAtom(cachedTimeGridAtom)[0];

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
	}, []);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !themeColors) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.clearRect(0, 0, width, height);

		const viewportStart = scrollLeft / pxPerMs;
		const viewportEnd = (scrollLeft + width) / pxPerMs;

		ctx.strokeStyle = themeColors.minor;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const ms of timeGrid.minors) {
			if (ms < viewportStart || ms > viewportEnd) continue;
			const x = Math.round(ms * pxPerMs);
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
		}
		ctx.stroke();

		ctx.strokeStyle = themeColors.major;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const marker of timeGrid.majors) {
			if (marker.ms < viewportStart || marker.ms > viewportEnd) continue;
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
