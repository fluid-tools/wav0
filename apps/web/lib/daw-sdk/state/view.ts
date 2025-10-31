/**
 * Viewport and derived metrics
 */

"use client";

import { time } from "@wav0/daw-sdk";
import { atom } from "jotai";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import { horizontalScrollAtom, playbackAtom, timelineAtom } from "./atoms";
import { gridAtom, musicalMetadataAtom } from "./index";
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

// Snap interval atom - derives snap interval from grid mode, BPM, and granularity
export const snapIntervalMsAtom = atom((get) => {
	const grid = get(gridAtom);
	const timeline = get(timelineAtom);
	const music = get(musicalMetadataAtom);
	const { snapGranularity, customSnapIntervalMs } = timeline;

	if (snapGranularity === "custom" && customSnapIntervalMs !== undefined) {
		return customSnapIntervalMs;
	}

	if (grid.mode === "time") {
		// For time mode, derive from granularity
		switch (snapGranularity) {
			case "coarse":
				return 1000; // 1 second
			case "fine":
				return 100; // 100ms
			case "medium":
			default:
				return 500; // 500ms
		}
	}

	// For bars mode, derive from grid resolution and granularity
	const den = music.timeSignature.den;
	const secondsPerBeat = (60 / music.tempoBpm) * (4 / den);
	const baseDivisionBeats = time.getDivisionBeats(
		grid.resolution,
		music.timeSignature,
	);
	const subdivBeats = grid.triplet ? baseDivisionBeats / 3 : baseDivisionBeats;

	switch (snapGranularity) {
		case "coarse":
			// Coarse: 1/4 notes (or division if larger)
			return Math.max(
				baseDivisionBeats * secondsPerBeat * 1000,
				secondsPerBeat * 1000,
			);
		case "fine": {
			// Fine: 1/16 of subdivision (or minimum 1/32 note)
			const fineBeats = subdivBeats / 4;
			return Math.max(fineBeats * secondsPerBeat * 1000, 50);
		}
		case "medium":
		default:
			// Medium: use current subdivision
			return subdivBeats * secondsPerBeat * 1000;
	}
});

// Cache key for time grid
export const timeGridCacheKeyAtom = atom((get) => {
	const pxPerMs = get(timelinePxPerMsAtom);
	const viewSpan = get(viewSpanMsAtom);
	const viewStart = get(viewStartMsAtom);
	const timeline = get(timelineAtom);
	const snapInterval = timeline.snapToGrid ? get(snapIntervalMsAtom) : null;

	return JSON.stringify({
		pxPerMs: Math.round(pxPerMs * 1000) / 1000, // Round to 3 decimal places
		viewSpan: Math.round(viewSpan * 10) / 10, // Round to 0.1ms precision
		viewStart: Math.round(viewStart * 10) / 10, // Round to 0.1ms precision
		snapInterval,
		snapToGrid: timeline.snapToGrid,
	});
});

// Bars grid code removed - time-only grid mode active

// Cached time grid atom with memoization
const timeGridCache = new Map<
	string,
	ReturnType<typeof time.generateTimeGrid>
>();

export const cachedTimeGridAtom = atom((get) => {
	const grid = get(gridAtom);
	const timeline = get(timelineAtom);

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

	// Pass snap interval when snap is enabled to align visual grid with snap points
	const snapIntervalMs =
		timeline.snapToGrid ? get(snapIntervalMsAtom) : undefined;

	const result = time.generateTimeGrid({
		viewStartMs,
		viewEndMs,
		pxPerMs,
		snapIntervalMs,
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
