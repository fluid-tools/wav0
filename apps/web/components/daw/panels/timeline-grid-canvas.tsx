"use client";
import { useAtom } from "jotai";
import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { cachedGridSubdivisionsAtom } from "@/lib/daw-sdk/state/view";
import { CanvasGridController } from "@/lib/daw-sdk/utils/canvas-grid-controller";

type Props = {
	width: number;
	height: number;
	pxPerMs: number;
	scrollLeft: number;
};

export function TimelineGridCanvas({
	width,
	height,
	pxPerMs,
	scrollLeft,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const controllerRef = useRef<CanvasGridController | null>(null);

	// Use deferred values for smooth high-frequency updates
	const deferredPxPerMs = useDeferredValue(pxPerMs);
	const deferredScrollLeft = useDeferredValue(scrollLeft);

	// Use cached grid subdivisions atom for optimal performance
	const grid = useAtom(cachedGridSubdivisionsAtom)[0];

	// Memoize theme colors to avoid repeated getComputedStyle calls
	const themeColors = useMemo(() => {
		if (!canvasRef.current) return null;

		const styles = getComputedStyle(canvasRef.current);
		return {
			sub:
				styles.getPropertyValue("--timeline-grid-sub").trim() ||
				"rgba(255,255,255,0.15)",
			beat:
				styles.getPropertyValue("--timeline-grid-beat").trim() ||
				"rgba(255,255,255,0.3)",
			measure:
				styles.getPropertyValue("--timeline-grid-measure").trim() ||
				"rgba(255,255,255,0.5)",
			label:
				styles.getPropertyValue("--timeline-grid-label").trim() ||
				"rgba(255,255,255,0.7)",
		};
	}, []); // Only compute once on mount

	// Initialize controller
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		controllerRef.current = new CanvasGridController(canvas);

		return () => {
			if (controllerRef.current) {
				controllerRef.current.dispose();
				controllerRef.current = null;
			}
		};
	}, []);

	// Draw grid when dependencies change
	useEffect(() => {
		const controller = controllerRef.current;
		if (!controller || !themeColors) return;

		controller.draw({
			width,
			height,
			pxPerMs: deferredPxPerMs,
			scrollLeft: deferredScrollLeft,
			grid,
			themeColors,
		});
	}, [width, height, deferredPxPerMs, deferredScrollLeft, grid, themeColors]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none"
			style={{ width, height }}
		/>
	);
}
