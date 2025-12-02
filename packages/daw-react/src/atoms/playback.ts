/**
 * Playback State Atoms
 * Write atoms for playback control
 */

"use client";

import type { PlaybackState, Track } from "@wav0/daw-sdk";
import { atom, type Getter, type Setter } from "jotai";
import { playbackAtom, totalDurationAtom, tracksAtom } from "./base";
import { loopRegionAtom } from "./project";
import { serviceRegistry } from "./service-registry";

// ===== Guarded Time Update =====

/**
 * Creates a time update callback with isolated throttling state.
 * Each playback session gets its own state to avoid cross-session interference.
 *
 * Handles:
 * - Global project looping (playbackAtom.looping)
 * - Loop region (loopRegionAtom with enabled, startMs, endMs)
 * - End-of-project detection
 */
function createGuardedTimeUpdateCallback(
	get: Getter,
	set: Setter,
	restartPlayback: () => Promise<void>,
) {
	// Per-instance throttling state (not shared across sessions)
	let lastUpdateTime = 0;
	let lastUpdateMs = 0;
	let isFirstUpdate = true;
	let isRestarting = false;

	return async (timeSeconds: number) => {
		// Prevent re-entrancy during restart
		if (isRestarting) return;

		const currentMs = Math.max(0, timeSeconds * 1000);
		const now = performance.now();

		// Detect playback restart (time jumped backwards significantly)
		if (currentMs < lastUpdateMs - 100) {
			isFirstUpdate = true;
		}

		// Prevent updates if time hasn't changed meaningfully
		if (!isFirstUpdate && Math.abs(currentMs - lastUpdateMs) < 0.01) return;

		// Smart throttling: skip if both time and update interval are small
		const timeDelta = Math.abs(currentMs - lastUpdateMs);
		if (!isFirstUpdate && now - lastUpdateTime < 8 && timeDelta < 10) return;

		isFirstUpdate = false;
		lastUpdateTime = now;
		lastUpdateMs = currentMs;

		const newPlayback = get(playbackAtom) as PlaybackState;

		// Check if playback is still active
		if (!newPlayback.isPlaying) {
			return;
		}

		// Get loop region state (read fresh each time to detect runtime changes)
		const loopRegion = get(loopRegionAtom);
		const total = get(totalDurationAtom) as number;

		// Determine effective loop boundary
		let loopEndMs = total;
		let loopStartMs = 0;

		if (loopRegion.enabled && loopRegion.endMs > loopRegion.startMs) {
			// Loop region is enabled - use its boundaries
			loopEndMs = loopRegion.endMs;
			loopStartMs = loopRegion.startMs;
		}

		// Check if we've reached the loop end (or project end)
		if (currentMs >= loopEndMs) {
			// Check looping flag (read fresh to detect runtime toggle)
			const currentPlayback = get(playbackAtom) as PlaybackState;

			if (currentPlayback.looping) {
				// Loop back to start
				isRestarting = true;
				try {
					set(playbackAtom, {
						...currentPlayback,
						currentTime: loopStartMs,
					});
					// Restart playback from loop start
					await restartPlayback();
				} finally {
					isRestarting = false;
				}
				return;
			}

			// Not looping - stop playback
			set(playbackAtom, { ...newPlayback, currentTime: 0, isPlaying: false });
			return;
		}

		// Only update atom if value changed meaningfully
		if (Math.abs(newPlayback.currentTime - currentMs) >= 0.01) {
			set(playbackAtom, { ...newPlayback, currentTime: currentMs });
		}
	};
}

// ===== Simple Atoms (for direct access) =====

export const isPlayingAtom = atom(
	(get) => get(playbackAtom).isPlaying,
	(get, set, value: boolean) => {
		const current = get(playbackAtom);
		set(playbackAtom, { ...current, isPlaying: value });
	},
);

export const currentTimeAtom = atom(
	(get) => get(playbackAtom).currentTime,
	(get, set, value: number) => {
		const current = get(playbackAtom);
		set(playbackAtom, { ...current, currentTime: value });
	},
);

export const bpmAtom = atom(
	(get) => get(playbackAtom).bpm,
	(get, set, value: number) => {
		const current = get(playbackAtom);
		const clamped = Math.max(
			30,
			Math.min(300, Number.isFinite(value) ? value : 120),
		);
		set(playbackAtom, { ...current, bpm: clamped });
	},
);

export const loopingAtom = atom(
	(get) => get(playbackAtom).looping,
	(get, set, value: boolean) => {
		const current = get(playbackAtom);
		set(playbackAtom, { ...current, looping: value });
	},
);

// ===== Write Atoms =====

export const togglePlaybackAtom = atom(null, async (get, set) => {
	const tracks = get(tracksAtom) as Track[];
	const playback = get(playbackAtom);

	if (!serviceRegistry.playbackService) {
		console.warn("Playback service not registered");
		return;
	}

	if (playback.isPlaying) {
		await serviceRegistry.playbackService.pause();
		set(playbackAtom, { ...playback, isPlaying: false });
		return;
	}

	const currentTimeSeconds = playback.currentTime / 1000;

	await serviceRegistry.playbackService.initializeWithTracks(tracks);

	// Create restart function for looping support
	const restartPlayback = async () => {
		const currentTracks = get(tracksAtom) as Track[];
		const loopRegion = get(loopRegionAtom);
		const startMs = loopRegion.enabled ? loopRegion.startMs : 0;

		await serviceRegistry.playbackService?.pause();
		await serviceRegistry.playbackService?.play(currentTracks, {
			startTime: startMs / 1000,
			onTimeUpdate: createGuardedTimeUpdateCallback(get, set, restartPlayback),
			onPlaybackEnd: () => {
				const endState = get(playbackAtom);
				set(playbackAtom, { ...endState, isPlaying: false });
			},
		});
	};

	// Each play() call creates a fresh callback with its own throttling state
	await serviceRegistry.playbackService.play(tracks, {
		startTime: currentTimeSeconds,
		onTimeUpdate: createGuardedTimeUpdateCallback(get, set, restartPlayback),
		onPlaybackEnd: () => {
			const endState = get(playbackAtom);
			set(playbackAtom, { ...endState, isPlaying: false });
		},
	});

	set(playbackAtom, { ...playback, isPlaying: true });
});

export const stopPlaybackAtom = atom(null, async (get, set) => {
	if (!serviceRegistry.playbackService) {
		console.warn("Playback service not registered");
		return;
	}

	await serviceRegistry.playbackService.stop();
	const playback = get(playbackAtom);
	set(playbackAtom, { ...playback, isPlaying: false });
});

export const setCurrentTimeAtom = atom(
	null,
	async (get, set, timeMs: number) => {
		const playback = get(playbackAtom);
		const tracks = get(tracksAtom) as Track[];

		set(playbackAtom, { ...playback, currentTime: timeMs });

		if (!playback.isPlaying || !serviceRegistry.playbackService) return;

		await serviceRegistry.playbackService.pause();

		// Create restart function for looping support
		const restartPlayback = async () => {
			const currentTracks = get(tracksAtom) as Track[];
			const loopRegion = get(loopRegionAtom);
			const startMs = loopRegion.enabled ? loopRegion.startMs : 0;

			await serviceRegistry.playbackService?.pause();
			await serviceRegistry.playbackService?.play(currentTracks, {
				startTime: startMs / 1000,
				onTimeUpdate: createGuardedTimeUpdateCallback(get, set, restartPlayback),
				onPlaybackEnd: () => {
					const endState = get(playbackAtom);
					set(playbackAtom, { ...endState, isPlaying: false });
				},
			});
		};

		// Each play() call creates a fresh callback with its own throttling state
		await serviceRegistry.playbackService.play(tracks, {
			startTime: timeMs / 1000,
			onTimeUpdate: createGuardedTimeUpdateCallback(get, set, restartPlayback),
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
