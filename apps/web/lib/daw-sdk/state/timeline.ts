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

export const setSnapGranularityAtom = atom(
	null,
	(get, set, granularity: "coarse" | "medium" | "fine" | "custom") => {
		const timeline = get(timelineAtom);
		set(timelineAtom, { ...timeline, snapGranularity: granularity });
	},
);

export const setCustomSnapIntervalAtom = atom(
	null,
	(get, set, intervalMs: number) => {
		const timeline = get(timelineAtom);
		set(timelineAtom, {
			...timeline,
			customSnapIntervalMs: intervalMs,
			snapGranularity: "custom",
		});
	},
);

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
