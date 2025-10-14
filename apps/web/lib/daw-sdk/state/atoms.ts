/**
 * Base DAW state atoms.
 * These primitive atoms are shared across domain-specific modules.
 */

"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
	AutomationType,
	ClipInspectorTarget,
	PlaybackState,
	TimelineSection,
	TimelineState,
	Tool,
	Track,
} from "./types";
import { volumeToDb } from "../utils/volume-utils";
import { createDefaultEnvelope } from "./types";

/**
 * Initialize tracks with default Track 1 if empty
 */
function getInitialTracks(): Track[] {
	if (typeof window === "undefined") return []; // SSR guard
	
	const stored = localStorage.getItem("daw-tracks");
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
		} catch {}
	}
	
	// Return default Track 1
	return [
		{
			id: crypto.randomUUID(),
			name: "Track 1",
			duration: 0,
			startTime: 0,
			trimStart: 0,
			trimEnd: 0,
			volume: 75,
			volumeDb: volumeToDb(75),
			muted: false,
			soloed: false,
			color: "#3b82f6",
			clips: [],
			volumeEnvelope: createDefaultEnvelope(75),
		},
	];
}

export const tracksAtom = atomWithStorage<Track[]>(
	"daw-tracks",
	getInitialTracks(),
);

export const playbackAtom = atom<PlaybackState>({
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	bpm: 120,
	looping: false,
});

export const timelineAtom = atom<TimelineState>({
	zoom: 0.5,
	scrollPosition: 0,
	snapToGrid: true,
	gridSize: 500,
});

export const timelineSectionsAtom = atom<TimelineSection[]>([]);

export const trackHeightZoomAtom = atom(1.0);
export const selectedTrackIdAtom = atom<string | null>(null);
export const selectedClipIdAtom = atom<string | null>(null);
export const clipInspectorOpenAtom = atom(false);
export const clipInspectorTargetAtom = atom<ClipInspectorTarget>(null);
export const eventListOpenAtom = atom(false);
export const activeToolAtom = atom<Tool>("pointer");
export const automationViewEnabledAtom = atom(false);
export const trackAutomationTypeAtom = atom<Map<string, AutomationType>>(
	new Map(),
);

export const projectNameAtom = atomWithStorage<string>(
	"daw-project-name",
	"Untitled Project",
);

export const projectEndOverrideAtom = atomWithStorage<number | null>(
	"daw-project-end-override",
	null,
);

export const horizontalScrollAtom = atom<number>(0);
export const verticalScrollAtom = atom<number>(0);

export const zoomLimitsAtom = atom<{ min: number; max: number }>({
	min: 0.05,
	max: 5,
});

export const playheadDraggingAtom = atom<boolean>(false);
export const userIsManuallyScrollingAtom = atom<boolean>(false);
export const playheadAutoFollowEnabledAtom = atom<boolean>(true);
