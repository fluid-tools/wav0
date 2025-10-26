/**
 * Unified coordinate system for timeline rendering
 * Single source of truth for playhead, project end, and grid calculations
 */

import { atom } from "jotai";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import {
	horizontalScrollAtom,
	playbackAtom,
	projectEndOverrideAtom,
	timelineAtom,
	verticalScrollAtom,
} from "./atoms";
import { totalDurationAtom } from "./tracks";

export type Coordinates = {
	pxPerMs: number;
	scrollLeft: number;
	scrollTop: number;
	playheadMs: number;
	playheadPx: number;
	projectEndMs: number;
	projectEndPx: number;
};

export const coordinatesAtom = atom<Coordinates>((get) => {
	const timeline = get(timelineAtom);
	const playback = get(playbackAtom);
	const scrollLeft = get(horizontalScrollAtom);
	const scrollTop = get(verticalScrollAtom);
	const durationMs = get(totalDurationAtom);
	const override = get(projectEndOverrideAtom);

	const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * timeline.zoom) / 1000;
	const playheadMs = Math.max(0, playback.currentTime);
	const projectEndMs = override !== null ? override : durationMs;

	return {
		pxPerMs,
		scrollLeft,
		scrollTop,
		playheadMs,
		playheadPx: playheadMs * pxPerMs,
		projectEndMs,
		projectEndPx: projectEndMs * pxPerMs,
	};
});

