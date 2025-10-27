/**
 * Viewport and derived metrics
 */

"use client";

import { atom } from "jotai";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import { generateTimeGrid, type TimeGrid } from "../utils/time-grid";
import { horizontalScrollAtom, playbackAtom, timelineAtom } from "./atoms";
import { gridAtom } from "./index";
import { totalDurationAtom } from "./tracks";

export type TimelineViewportMetrics = {
	pxPerMs: number;
	zoom: number;
	horizontalScroll: number;
	playheadViewportPx: number;
	projectEndViewportPx: number;
};

export const timelineViewportAtom = atom<TimelineViewportMetrics>((get) => {
	const timeline = get(timelineAtom);
	const playback = get(playbackAtom);
	const scroll = get(horizontalScrollAtom);
	const durationMs = get(totalDurationAtom);

	const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * timeline.zoom) / 1000;
	const clampedPxPerMs = Number.isFinite(pxPerMs) ? pxPerMs : 0;
	const clampedScroll = Number.isFinite(scroll) ? scroll : 0;
	const safeCurrentTime = Number.isFinite(playback.currentTime)
		? playback.currentTime
		: 0;
	const safeDurationMs = Number.isFinite(durationMs) ? durationMs : 0;

	return {
		pxPerMs: clampedPxPerMs,
		zoom: timeline.zoom,
		horizontalScroll: clampedScroll,
		playheadViewportPx: safeCurrentTime * clampedPxPerMs - clampedScroll,
		projectEndViewportPx: safeDurationMs * clampedPxPerMs - clampedScroll,
	};
});

export const timelineWidthAtom = atom((get) => {
	const durationMs = get(totalDurationAtom);
	const { pxPerMs, zoom } = get(timelineViewportAtom);
	const durationPx = durationMs * pxPerMs;
	const paddingPx = DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom * 2;
	return durationPx + paddingPx;
});

export const projectEndPositionAtom = atom((get) => {
	const durationMs = get(totalDurationAtom);
	const { pxPerMs } = get(timelineViewportAtom);
	return durationMs * pxPerMs;
});

export const playheadViewportPxAtom = atom(
	(get) => get(timelineViewportAtom).playheadViewportPx,
);

export const projectEndViewportPxAtom = atom(
	(get) => get(timelineViewportAtom).projectEndViewportPx,
);

export const timelinePxPerMsAtom = atom(
	(get) => get(timelineViewportAtom).pxPerMs,
);

export const playheadViewportAtom = atom((get) => {
	const { pxPerMs, horizontalScroll } = get(timelineViewportAtom);
	const playback = get(playbackAtom);
	const rawX = playback.currentTime * pxPerMs;
	return {
		absolutePx: rawX,
		viewportPx: rawX - horizontalScroll,
		ms: playback.currentTime,
	};
});

// Derived atoms for canvas grid performance optimization
export const viewStartMsAtom = atom((get) => {
	const { pxPerMs, horizontalScroll } = get(timelineViewportAtom);
	return horizontalScroll / pxPerMs;
});

export const viewEndMsAtom = atom((get) => {
	const { pxPerMs, horizontalScroll } = get(timelineViewportAtom);
	const timelineWidth = get(timelineWidthAtom);
	return (horizontalScroll + timelineWidth) / pxPerMs;
});

export const viewSpanMsAtom = atom((get) => {
	const start = get(viewStartMsAtom);
	const end = get(viewEndMsAtom);
	return end - start;
});

// Cache key for time grid
export const timeGridCacheKeyAtom = atom((get) => {
	const pxPerMs = get(timelinePxPerMsAtom);
	const viewSpan = get(viewSpanMsAtom);
	const viewStart = get(viewStartMsAtom);

	return JSON.stringify({
		pxPerMs: Math.round(pxPerMs * 1000) / 1000, // Round to 3 decimal places
		viewSpan: Math.round(viewSpan * 10) / 10, // Round to 0.1ms precision
		viewStart: Math.round(viewStart * 10) / 10, // Round to 0.1ms precision
	});
});

// Bars grid code removed - time-only grid mode active

// Cached time grid atom with memoization
const timeGridCache = new Map<string, TimeGrid>();

export const cachedTimeGridAtom = atom((get) => {
	const grid = get(gridAtom);
	
	// Only generate time grid if mode is "time"
	if (grid.mode !== "time") {
		return { majors: [], minors: [] };
	}

	const cacheKey = get(timeGridCacheKeyAtom);

	// Return cached result if available
	const cached = timeGridCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	// Compute new time grid
	const viewStartMs = get(viewStartMsAtom);
	const viewEndMs = get(viewEndMsAtom);
	const pxPerMs = get(timelinePxPerMsAtom);

	const result = generateTimeGrid({
		viewStartMs,
		viewEndMs,
		pxPerMs,
	});

	// Cache the result
	timeGridCache.set(cacheKey, result);

	// Limit cache size to prevent memory leaks
	if (timeGridCache.size > 50) {
		const firstKey = timeGridCache.keys().next().value;
		if (firstKey) {
			timeGridCache.delete(firstKey);
		}
	}

	return result;
});
