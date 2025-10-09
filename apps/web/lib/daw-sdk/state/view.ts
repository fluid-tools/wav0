/**
 * Viewport and derived metrics
 */

"use client";

import { atom } from "jotai";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import { horizontalScrollAtom, playbackAtom, timelineAtom } from "./atoms";
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
