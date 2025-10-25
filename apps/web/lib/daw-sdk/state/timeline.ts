"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
	horizontalScrollAtom,
	timelineAtom,
	timelineSectionsAtom,
	zoomLimitsAtom,
} from "./atoms";
import type { TimelineSection } from "./types";

export const loopRegionAtom = atomWithStorage("daw-loop-region", {
	enabled: false,
	startMs: 0,
	endMs: 60000,
});

export const addTimelineSectionAtom = atom(
	null,
	(get, set, section: Omit<TimelineSection, "id">) => {
		const sections = get(timelineSectionsAtom);
		const newSection: TimelineSection = {
			...section,
			id: crypto.randomUUID(),
		};
		set(timelineSectionsAtom, [...sections, newSection]);
	},
);

export const updateTimelineSectionAtom = atom(
	null,
	(get, set, sectionId: string, updates: Partial<TimelineSection>) => {
		const sections = get(timelineSectionsAtom);
		set(
			timelineSectionsAtom,
			sections.map((section) =>
				section.id === sectionId ? { ...section, ...updates } : section,
			),
		);
	},
);

export const removeTimelineSectionAtom = atom(
	null,
	(get, set, sectionId: string) => {
		const sections = get(timelineSectionsAtom);
		set(
			timelineSectionsAtom,
			sections.filter((section) => section.id !== sectionId),
		);
	},
);

export const setTimelineZoomAtom = atom(null, (get, set, zoom: number) => {
	const limits = get(zoomLimitsAtom);
	const clamped = Math.max(limits.min, Math.min(limits.max, zoom));
	const timeline = get(timelineAtom);
	set(timelineAtom, { ...timeline, zoom: clamped });
});

// Discrete zoom steps and helpers
export const ZOOM_STEPS = [
	0.2, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2, 3, 4, 5,
] as const;

function nearestZoomIndex(z: number): number {
	let idx = 0;
	let best = Number.POSITIVE_INFINITY;
	for (let i = 0; i < ZOOM_STEPS.length; i++) {
		const d = Math.abs(ZOOM_STEPS[i] - z);
		if (d < best) {
			best = d;
			idx = i;
		}
	}
	return idx;
}

export const setTimelineZoomPrevAtom = atom(null, (get, set) => {
	const limits = get(zoomLimitsAtom);
	const timeline = get(timelineAtom);
	const i = nearestZoomIndex(timeline.zoom);
	const j = Math.max(0, i - 1);
	const next = Math.max(limits.min, ZOOM_STEPS[j]);
	set(timelineAtom, { ...timeline, zoom: next });
});

export const setTimelineZoomNextAtom = atom(null, (get, set) => {
	const limits = get(zoomLimitsAtom);
	const timeline = get(timelineAtom);
	const i = nearestZoomIndex(timeline.zoom);
	const j = Math.min(ZOOM_STEPS.length - 1, i + 1);
	const next = Math.min(limits.max, ZOOM_STEPS[j]);
	set(timelineAtom, { ...timeline, zoom: next });
});

export const setTimelineScrollAtom = atom(
	null,
	(get, set, scrollPosition: number) => {
		const timeline = get(timelineAtom);
		set(timelineAtom, {
			...timeline,
			scrollPosition,
		});
	},
);

export const setTimelineGridSizeAtom = atom(
	null,
	(get, set, gridSize: number) => {
		const timeline = get(timelineAtom);
		set(timelineAtom, { ...timeline, gridSize });
	},
);

export const toggleSnapToGridAtom = atom(null, (get, set) => {
	const timeline = get(timelineAtom);
	set(timelineAtom, { ...timeline, snapToGrid: !timeline.snapToGrid });
});

export const setHorizontalScrollAtom = atom(
	null,
	(_get, set, scroll: number) => {
		set(horizontalScrollAtom, scroll);
	},
);

// Deferred zoom atom for smooth high-frequency updates
export const deferredZoomAtom = atom((get) => {
	const timeline = get(timelineAtom);
	return timeline.zoom;
});
