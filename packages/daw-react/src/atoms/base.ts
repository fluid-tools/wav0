/**
 * Base DAW state atoms
 */

"use client";

import { atom } from "jotai";
import { atomWithStorage } from "./storage";
import { volume } from "@wav0/daw-sdk";
import type {
	AutomationType,
	ClipInspectorTarget,
	PlaybackState,
	TimelineSection,
	TimelineState,
	Tool,
	Track,
	TrackEnvelope,
} from "@wav0/daw-sdk";

function createDefaultEnvelope(volumePercent: number): TrackEnvelope {
	return {
		enabled: false,
		points: [
			{
				id: crypto.randomUUID(),
				time: 0,
				value: 1.0,
			},
		],
		segments: [],
	};
}

/**
 * Default Track 1 for new projects
 * Static value - storage adapter handles loading persisted data
 */
const DEFAULT_TRACK_1: Track = {
	id: crypto.randomUUID(),
	name: "Track 1",
	duration: 0,
	startTime: 0,
	trimStart: 0,
	trimEnd: 0,
	volume: 75,
	volumeDb: volume.volumeToDb(75),
	muted: false,
	soloed: false,
	color: "#3b82f6",
	clips: [],
	volumeEnvelope: createDefaultEnvelope(75),
};

// atomWithStorage handles loading from storage in onMount
// No module-time localStorage access - prevents race conditions
export const tracksAtom = atomWithStorage<Track[]>("daw-tracks", [DEFAULT_TRACK_1]);

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

