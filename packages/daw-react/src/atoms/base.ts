/**
 * Base DAW state atoms
 * Primitive atoms shared across domain-specific modules
 */

"use client";

import type {
	AutomationType,
	Clip,
	ClipInspectorTarget,
	PlaybackState,
	TimelineSection,
	TimelineState,
	Tool,
	Track,
	TrackEnvelope,
} from "@wav0/daw-sdk";
import { volume } from "@wav0/daw-sdk";
import { atom } from "jotai";
import { atomWithStorage } from "./storage";

// ===== Helpers =====

export function createDefaultEnvelope(_volumePercent: number): TrackEnvelope {
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

export function createDefaultTrack(name: string, color: string): Track {
	return {
		id: crypto.randomUUID(),
		name,
		duration: 0,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		volume: 75,
		volumeDb: volume.volumeToDb(75),
		muted: false,
		soloed: false,
		color,
		clips: [],
		volumeEnvelope: createDefaultEnvelope(75),
	};
}

/**
 * Default Track 1 for new projects
 * Uses stable ID to prevent mismatches with localStorage persistence
 */
export const DEFAULT_TRACK_1: Track = {
	...createDefaultTrack("Track 1", "#3b82f6"),
	id: "default-track-1",
};

// ===== Core State Atoms =====

/**
 * Track list with localStorage persistence
 * atomWithStorage handles loading from storage in onMount
 */
export const tracksAtom = atomWithStorage<Track[]>("daw-tracks", [
	DEFAULT_TRACK_1,
]);

/**
 * Playback state (volatile - not persisted)
 */
export const playbackAtom = atom<PlaybackState>({
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	bpm: 120,
	looping: false,
});

/**
 * Extended timeline state for snap granularity
 * NOTE: TimelineState from SDK now includes these fields, but we extend here
 * for backwards compatibility until all usages are updated
 */
export type ExtendedTimelineState = TimelineState;

/**
 * Timeline state (volatile - not persisted)
 */
export const timelineAtom = atom<ExtendedTimelineState>({
	zoom: 0.5,
	scrollPosition: 0,
	snapToGrid: true,
	gridSize: 500,
	snapGranularity: "medium",
	customSnapIntervalMs: undefined,
});

/**
 * Timeline sections (persisted)
 */
export const timelineSectionsAtom = atomWithStorage<TimelineSection[]>(
	"daw-timeline-sections",
	[],
);

// ===== View State Atoms =====

export const trackHeightZoomAtom = atom(1.0);
export const horizontalScrollAtom = atom<number>(0);
export const verticalScrollAtom = atom<number>(0);
export const zoomLimitsAtom = atom<{ min: number; max: number }>({
	min: 0.05,
	max: 5,
});

// ===== Selection Atoms =====

export const selectedTrackIdAtom = atom<string | null>(null);
export const selectedClipIdAtom = atom<string | null>(null);

// ===== Inspector/Panel Atoms =====

export const clipInspectorOpenAtom = atom(false);
export const clipInspectorTargetAtom = atom<ClipInspectorTarget>(null);
export const eventListOpenAtom = atom(false);

// ===== Tool State Atoms =====

export const activeToolAtom = atom<Tool>("pointer");
export const automationViewEnabledAtom = atom(false);
export const trackAutomationTypeAtom = atom<Map<string, AutomationType>>(
	new Map(),
);

// ===== Project Atoms =====

export const projectNameAtom = atomWithStorage<string>(
	"daw-project-name",
	"Untitled Project",
);

export const projectEndOverrideAtom = atomWithStorage<number | null>(
	"daw-project-end-override",
	null,
);

// ===== Playhead/Scroll Atoms =====

export const playheadDraggingAtom = atom<boolean>(false);
export const userIsManuallyScrollingAtom = atom<boolean>(false);
export const playheadAutoFollowEnabledAtom = atom<boolean>(true);

// ===== Derived Atoms =====

/**
 * Total duration across all tracks/clips
 * Uses trimmed region (trimEnd - trimStart) for accurate duration calculation
 */
export const totalDurationAtom = atom((get) => {
	const tracks = get(tracksAtom);
	if (tracks.length === 0) return 0;

	const override = get(projectEndOverrideAtom);

	const perTrackEnds = tracks.map((track) => {
		if (track.clips && track.clips.length > 0) {
			return Math.max(
				...track.clips.map((clip: Clip) => {
					const oneShotEnd =
						clip.startTime + Math.max(0, clip.trimEnd - clip.trimStart);
					const loopEnd = clip.loop ? (clip.loopEnd ?? oneShotEnd) : oneShotEnd;
					return loopEnd;
				}),
				0,
			);
		}
		return track.startTime + track.duration;
	});

	const tracksDuration = Math.max(...perTrackEnds, 0);
	const minimumDuration = 180_000;

	if (override !== null) {
		return Math.max(override, tracksDuration);
	}

	return Math.max(tracksDuration, minimumDuration);
});
