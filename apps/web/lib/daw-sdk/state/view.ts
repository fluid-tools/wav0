/**
 * Viewport and derived metrics
 */

"use client";

import { atom } from "jotai";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import { generateTimeGrid, type TimeGrid } from "../utils/time-grid";
import { getDivisionBeats } from "../utils/time-utils";
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

// Cache key for grid subdivisions (bars mode - legacy)
export const gridCacheKeyAtom = atom((get) => {
	const tempoBpm = get(musicalMetadataAtom).tempoBpm;
	const timeSignature = get(musicalMetadataAtom).timeSignature;
	const grid = get(gridAtom);
	const pxPerMs = get(timelinePxPerMsAtom);
	const viewSpan = get(viewSpanMsAtom);
	const viewStart = get(viewStartMsAtom);

	return JSON.stringify({
		tempo: tempoBpm,
		signature: timeSignature,
		resolution: grid.resolution,
		triplet: grid.triplet,
		swing: grid.swing,
		pxPerMs: Math.round(pxPerMs * 1000) / 1000, // Round to avoid floating point precision issues
		viewSpan: Math.round(viewSpan * 10) / 10, // Round to 0.1ms precision
		viewStart: Math.round(viewStart * 10) / 10, // Round to 0.1ms precision
	});
});

// Cached grid subdivisions atom with memoization
const gridSubdivisionsCache = new Map<
	string,
	{
		measures: Array<{ ms: number; bar: number }>;
		beats: Array<{ ms: number; primary: boolean }>;
		subs: number[];
	}
>();

export const cachedGridSubdivisionsAtom = atom((get) => {
	const cacheKey = get(gridCacheKeyAtom);

	// Return cached result if available
	const cached = gridSubdivisionsCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	// Compute new subdivisions
	const viewStartMs = get(viewStartMsAtom);
	const viewEndMs = get(viewEndMsAtom);
	const pxPerMs = get(timelinePxPerMsAtom);
	const music = get(musicalMetadataAtom);
	const grid = get(gridAtom);

	if (grid.mode === "time") {
		const result = { measures: [], beats: [], subs: [] };
		gridSubdivisionsCache.set(cacheKey, result);
		return result;
	}

	const measures: Array<{ ms: number; bar: number }> = [];
	const beats: Array<{ ms: number; primary: boolean }> = [];
	const subs: number[] = [];

	// Calculate musical timing
	const secondsPerBeat = (60 / music.tempoBpm) * (4 / music.timeSignature.den);
	const msPerBeat = secondsPerBeat * 1000;
	const msPerBar = music.timeSignature.num * msPerBeat;

	// Compound grouping: if den===8 and num % 3 === 0, group beats by 3
	const isCompound =
		music.timeSignature.den === 8 && music.timeSignature.num % 3 === 0;
	const groupBeats = isCompound ? 3 : 1;

	// Get subdivision info
	const divisionBeats = getDivisionBeats(grid.resolution, music.timeSignature);
	const subdivBeats = grid.triplet ? divisionBeats / 3 : divisionBeats;

	// Iterate bars from view start to view end
	const startBar = Math.floor(viewStartMs / msPerBar);
	const endBar = Math.ceil(viewEndMs / msPerBar);

	for (let barIndex = startBar; barIndex <= endBar; barIndex++) {
		const barMs = barIndex * msPerBar;

		// Add measure if in range
		if (barMs >= viewStartMs && barMs <= viewEndMs) {
			measures.push({ ms: barMs, bar: barIndex + 1 });
		}

		// Add beats within this bar
		for (let k = 0; k < music.timeSignature.num; k++) {
			const beatMs = barMs + k * msPerBeat;
			if (beatMs >= viewStartMs && beatMs <= viewEndMs && beatMs !== barMs) {
				const primary = k % groupBeats === 0;
				beats.push({ ms: beatMs, primary });
			}
		}

		// Add subdivisions
		const divisionsPerBar = music.timeSignature.num / subdivBeats;
		for (let i = 1; i < divisionsPerBar; i++) {
			const subMs = barMs + i * subdivBeats * msPerBeat;
			if (subMs >= viewStartMs && subMs <= viewEndMs) {
				// Apply swing visual bias only to subs (even index)
				let finalSubMs = subMs;
				if (grid.swing && grid.swing > 0 && !grid.triplet) {
					const isEven = i % 2 === 0;
					const swing01 = grid.swing / 100; // Normalize from 0-100 to 0-1
					const bias = isEven
						? 0
						: swing01 * (2 / 3 - 1 / 2) * subdivBeats * msPerBeat;
					finalSubMs += bias;
				}
				subs.push(finalSubMs);
			}
		}
	}

	// Density gates (declutter based on pixel spacing)
	const pxPerBeat = pxPerMs * msPerBeat;
	const pxPerSub = pxPerMs * subdivBeats * msPerBeat;

	// Filter based on pixel density
	const filteredBeats =
		pxPerBeat >= 14
			? beats
			: pxPerBeat >= 8
				? beats.filter((b) => b.primary)
				: [];
	const filteredSubs = pxPerSub >= 12 ? subs : [];

	const result = {
		measures,
		beats: filteredBeats,
		subs: filteredSubs,
	};

	// Cache the result
	gridSubdivisionsCache.set(cacheKey, result);

	// Limit cache size to prevent memory leaks
	if (gridSubdivisionsCache.size > 50) {
		const firstKey = gridSubdivisionsCache.keys().next().value;
		if (firstKey) {
			gridSubdivisionsCache.delete(firstKey);
		}
	}

	return result;
});

// Cached time grid atom with memoization
const timeGridCache = new Map<string, TimeGrid>();

export const cachedTimeGridAtom = atom((get) => {
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
