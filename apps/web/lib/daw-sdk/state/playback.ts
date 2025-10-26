"use client";

import { atom, type Getter, type Setter } from "jotai";
import { playbackService } from "../index";
import { playbackAtom, tracksAtom } from "./atoms";
import { totalDurationAtom } from "./tracks";
import type { PlaybackState, Track } from "./types";

// Guarded onTimeUpdate callback to prevent recursion
let lastUpdateTime = 0;
let lastUpdateMs = 0;

function createGuardedTimeUpdateCallback(get: Getter, set: Setter) {
	return (timeSeconds: number) => {
		const currentMs = Math.max(0, Math.round(timeSeconds * 1000));
		const now = performance.now();

		// Prevent updates if time hasn't changed
		if (currentMs === lastUpdateMs) return;

		// Limit update frequency to ~60Hz (16ms intervals)
		if (now - lastUpdateTime < 16) return;

		lastUpdateTime = now;
		lastUpdateMs = currentMs;

		const newPlayback = get(playbackAtom) as PlaybackState;
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
		return;
	}

	const currentTimeSeconds = playback.currentTime / 1000;

	await playbackService.initializeWithTracks(tracks);

	await playbackService.play(tracks, {
		startTime: currentTimeSeconds,
		onTimeUpdate: createGuardedTimeUpdateCallback(get, set),
		onPlaybackEnd: () => {
			const endState = get(playbackAtom);
			set(playbackAtom, { ...endState, isPlaying: false });
		},
	});

	set(playbackAtom, { ...playback, isPlaying: true });
});

export const stopPlaybackAtom = atom(null, async (get, set) => {
	await playbackService.stop();
	const playback = get(playbackAtom);
	set(playbackAtom, { ...playback, isPlaying: false });
});

export const setCurrentTimeAtom = atom(
	null,
	async (get, set, timeMs: number) => {
		const playback = get(playbackAtom);
		const tracks = get(tracksAtom) as Track[];

		set(playbackAtom, { ...playback, currentTime: timeMs });

		if (!playback.isPlaying) return;

		await playbackService.pause();

		await playbackService.play(tracks, {
			startTime: timeMs / 1000,
			onTimeUpdate: createGuardedTimeUpdateCallback(get, set),
			onPlaybackEnd: () => {
				const endState = get(playbackAtom);
				set(playbackAtom, { ...endState, isPlaying: false });
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

// Throttled playhead render atom for 60Hz visual updates
let playheadLast = { now: 0, value: 0 };

export const playheadRenderAtom = atom<number>((get) => {
	const playback = get(playbackAtom);
	const t = playback.currentTime;
	const now = performance.now();

	// Only update display at 60fps max (16ms intervals)
	if (playheadLast.now > 0 && now - playheadLast.now < 16) {
		return playheadLast.value;
	}

	playheadLast = { now, value: t };
	return t;
});
