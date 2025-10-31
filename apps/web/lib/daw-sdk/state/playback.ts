"use client";

/**
 * Playback State Atoms - Legacy Layer
 *
 * NOTE: These write atoms use the old playbackService directly.
 * For new code, prefer using `useBridgeMutations()` from @wav0/daw-react
 * which provides bridge-based mutations with event-driven sync.
 *
 * These atoms remain for backward compatibility during migration.
 */

import { atom, type Getter, type Setter } from "jotai";
import { playbackService } from "../index";
import { playbackAtom, tracksAtom } from "./atoms";
import { totalDurationAtom } from "./tracks";
import type { PlaybackState, Track } from "./types";

// Guarded onTimeUpdate callback to prevent recursion
let lastUpdateTime = 0;
let lastUpdateMs = 0;
let isFirstUpdate = true;

function createGuardedTimeUpdateCallback(get: Getter, set: Setter) {
	return (timeSeconds: number) => {
		const currentMs = Math.max(0, Math.round(timeSeconds * 1000));
		const now = performance.now();

		// Note: isFirstUpdate is now reset at playback start/stop boundaries
		// This check remains as a safety net for edge cases
		if (currentMs < lastUpdateMs - 100) {
			isFirstUpdate = true;
		}

		// Prevent updates if time hasn't changed, but allow first update
		// even if time matches (e.g., starting from position 0)
		// This ensures the initial synchronous update is always processed
		if (!isFirstUpdate && currentMs === lastUpdateMs) return;

		// Allow immediate first update without throttling for instant visual sync
		// After first update, throttle to ~60Hz (16ms intervals)
		if (!isFirstUpdate && now - lastUpdateTime < 16) return;

		isFirstUpdate = false;
		lastUpdateTime = now;
		lastUpdateMs = currentMs;

		const newPlayback = get(playbackAtom) as PlaybackState;

		// Critical: Check if playback is still active before updating
		// This prevents infinite loops when playback has been stopped but callback still fires
		if (!newPlayback.isPlaying) {
			return;
		}

		const total = get(totalDurationAtom) as number;

		if (currentMs >= total) {
			set(playbackAtom, { ...newPlayback, currentTime: 0, isPlaying: false });
			return;
		}

		// Only update if the value actually changed
		if (newPlayback.currentTime !== currentMs) {
			set(playbackAtom, { ...newPlayback, currentTime: currentMs });
		}
	};
}

export const togglePlaybackAtom = atom(null, async (get, set) => {
	const tracks = get(tracksAtom) as Track[];
	const playback = get(playbackAtom);

	if (playback.isPlaying) {
		await playbackService.pause();
		set(playbackAtom, { ...playback, isPlaying: false });
		// Reset first update flag when playback stops for next session
		isFirstUpdate = true;
		return;
	}

	const currentTimeSeconds = playback.currentTime / 1000;

	// Reset first update flag at start of new playback session
	isFirstUpdate = true;

	await playbackService.initializeWithTracks(tracks);

	await playbackService.play(tracks, {
		startTime: currentTimeSeconds,
		onTimeUpdate: createGuardedTimeUpdateCallback(get, set),
		onPlaybackEnd: () => {
			const endState = get(playbackAtom);
			set(playbackAtom, { ...endState, isPlaying: false });
			// Reset first update flag when playback ends
			isFirstUpdate = true;
		},
	});

	set(playbackAtom, { ...playback, isPlaying: true });
});

export const stopPlaybackAtom = atom(null, async (get, set) => {
	await playbackService.stop();
	const playback = get(playbackAtom);
	set(playbackAtom, { ...playback, isPlaying: false });
	// Reset first update flag when playback stops
	isFirstUpdate = true;
});

export const setCurrentTimeAtom = atom(
	null,
	async (get, set, timeMs: number) => {
		const playback = get(playbackAtom);
		const tracks = get(tracksAtom) as Track[];

		set(playbackAtom, { ...playback, currentTime: timeMs });

		if (!playback.isPlaying) return;

		await playbackService.pause();

		// Reset first update flag when restarting playback for seek
		isFirstUpdate = true;

		await playbackService.play(tracks, {
			startTime: timeMs / 1000,
			onTimeUpdate: createGuardedTimeUpdateCallback(get, set),
			onPlaybackEnd: () => {
				const endState = get(playbackAtom);
				set(playbackAtom, { ...endState, isPlaying: false });
				// Reset first update flag when playback ends
				isFirstUpdate = true;
			},
		});
	},
);

export const setBpmAtom = atom(null, (get, set, bpm: number) => {
	const playback = get(playbackAtom);
	const clamped = Math.max(30, Math.min(300, Number.isFinite(bpm) ? bpm : 120));
	set(playbackAtom, { ...playback, bpm: clamped });
});

export const toggleLoopingAtom = atom(null, (get, set) => {
	const playback = get(playbackAtom);
	set(playbackAtom, { ...playback, looping: !playback.looping });
});
