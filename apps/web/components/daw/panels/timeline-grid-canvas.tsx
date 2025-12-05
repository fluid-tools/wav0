"use client";
import {
	cachedTimeGridAtom,
	horizontalScrollAtom,
	timelinePxPerMsAtom,
} from "@wav0/daw-react";
import { useAtom } from "jotai";
import { memo, useLayoutEffect, useRef, useState } from "react";
import { TimelineGridHeader } from "./timeline-grid-header";

type ThemeColors = {
	minor: string;
	major: string;
};

type Props = {
	width: number;
	height: number;
};

export const TimelineGridCanvas = memo(function TimelineGridCanvas({
	width,
	height,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [scrollLeft] = useAtom(horizontalScrollAtom);

	const timeGrid = useAtom(cachedTimeGridAtom)[0];

	// Initialize theme colors ONCE after canvas mounts
	const [themeColors, setThemeColors] = useState<ThemeColors | null>(null);

	// Read theme colors from DOM on mount (runs once)
	useLayoutEffect(() => {
		if (themeColors || !canvasRef.current) return;

		const styles = getComputedStyle(canvasRef.current);
		setThemeColors({
			minor:
				styles.getPropertyValue("--timeline-grid-sub").trim() ||
				"rgba(255,255,255,0.15)",
			major:
				styles.getPropertyValue("--timeline-grid-measure").trim() ||
				"rgba(255,255,255,0.4)",
		});
	}, [themeColors]);

	// Draw grid lines
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
		<div className="relative" style={{ width, height }}>
			<canvas
				ref={canvasRef}
				className="absolute inset-0 pointer-events-none"
				width={width}
				height={height}
				style={{ width, height }}
			/>
			<TimelineGridHeader width={width} height={height} />
		</div>
	);
});
