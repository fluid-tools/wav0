"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Estimate horizontal scrub velocity in ms/s.
 * Provide pointer positions in viewport px, and pxPerMs for conversion.
 * Uses EMA smoothing and clamps to sane bounds.
 */
export function useScrubVelocity(
	options: { alpha?: number; max?: number } = {},
) {
	const alpha = options.alpha ?? 0.35; // EMA smoothing factor
	const max = options.max ?? 20000; // cap 20s per s
	const last = useRef<{ x: number; t: number } | null>(null);
	const ema = useRef(0);
	const [value, setValue] = useState<number>(Infinity);
	const isActiveRef = useRef(false);
	const lastUpdateTime = useRef<number>(0);
	const raf = useRef(0);

	useEffect(() => {
		function onTick() {
			const now = performance.now();
			// If movement has paused for more than 100ms, start decay
			if (isActiveRef.current && now - lastUpdateTime.current > 100) {
				isActiveRef.current = false;
			}

			// Only decay when not actively scrubbing
			if (!isActiveRef.current) {
				// decay toward Infinity (idle) when no movement
				ema.current *= 0.9;
				const v = Math.abs(ema.current);
				// Immediately update value atom during decay to keep it in sync
				setValue(v < 1e-2 ? Infinity : v);
			}
			raf.current = requestAnimationFrame(onTick);
		}
		raf.current = requestAnimationFrame(onTick);
		return () => {
			if (raf.current) cancelAnimationFrame(raf.current);
		};
	}, []);

	function update(
		pointerXpx: number,
		pxPerMs: number,
		timeStamp?: number,
	): number | undefined {
		const now = timeStamp ?? performance.now();
		if (!Number.isFinite(pxPerMs) || pxPerMs <= 0) return;
		isActiveRef.current = true; // Mark as actively scrubbing
		lastUpdateTime.current = now; // Track when we last updated
		const state = last.current;
		last.current = { x: pointerXpx, t: now };
		if (!state) return;
		const dx = pointerXpx - state.x; // px
		const dt = Math.max(0.5, now - state.t); // ms
		const vx_px_per_ms = dx / dt;
		const vx_ms_per_ms = vx_px_per_ms / pxPerMs;
		const vx_ms_per_s = vx_ms_per_ms * 1000;
		// EMA
		const next = alpha * vx_ms_per_s + (1 - alpha) * ema.current;
		ema.current = Math.max(-max, Math.min(max, next));
		const v = Math.abs(ema.current);
		setValue(v);
		return v;
	}

	function reset() {
		isActiveRef.current = false; // Stop actively scrubbing
		last.current = null;
		ema.current = 0;
		setValue(Infinity);
	}

	return { scrubVelocity: value, update, reset };
}
