/**
 * Playback State Atoms
 * Write atoms for playback control
 */

"use client";

import type { WritableAtom } from "jotai";
import { atom, type Getter, type Setter } from "jotai";
import { playbackAtom, totalDurationAtom, tracksAtom } from "./base";
import { loopRegionAtom } from "./project";
import { serviceRegistry } from "./service-registry";

type SafeState = { disposed: boolean; label: string };

function safeSet<Value>(
	setter: Setter,
	targetAtom: unknown,
	value: Value,
	state: SafeState,
) {
	if (state.disposed) return;
	try {
		const atomRef = targetAtom as WritableAtom<
			Value,
			[Value | ((prev: Value) => Value)],
			void
		>;
		setter(atomRef, value);
	} catch (error) {
		console.warn(`[playbackAtom] set failed (${state.label})`, error);
		state.disposed = true;
	}
}

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
	state: SafeState,
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

		const newPlayback = get(playbackAtom);

		// Check if playback is still active
		if (!newPlayback.isPlaying) {
			return;
		}

		// Get loop region state (read fresh each time to detect runtime changes)
		const loopRegion = get(loopRegionAtom);
		const total = get(totalDurationAtom);

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
			const currentPlayback = get(playbackAtom);

			if (currentPlayback.looping) {
				// Loop back to start
				isRestarting = true;
				try {
					safeSet(
						set,
						playbackAtom,
						{
							...currentPlayback,
							currentTime: loopStartMs,
						},
						state,
					);
					// Restart playback from loop start
					await restartPlayback();
				} finally {
					isRestarting = false;
				}
				return;
			}

			// Not looping - stop playback
			safeSet(
				set,
				playbackAtom,
				{ ...newPlayback, currentTime: 0, isPlaying: false },
				state,
			);
			return;
		}

		// Only update atom if value changed meaningfully
		if (Math.abs(newPlayback.currentTime - currentMs) >= 0.01) {
			safeSet(
				set,
				playbackAtom,
				{ ...newPlayback, currentTime: currentMs },
				state,
			);
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
	const tracks = get(tracksAtom);
	const playback = get(playbackAtom);
	const state = { disposed: false, label: "toggle" };

	if (!serviceRegistry.playbackService) {
		console.warn("Playback service not registered");
		return;
	}

	if (playback.isPlaying) {
		await serviceRegistry.playbackService.pause();
		safeSet(set, playbackAtom, { ...playback, isPlaying: false }, state);
		return;
	}

	const currentTimeSeconds = playback.currentTime / 1000;

	await serviceRegistry.playbackService.initializeWithTracks(tracks);

	// Hoist callback creation to prevent accumulation on loop restarts
	const restartPlaybackRef = { current: null as (() => Promise<void>) | null };

	// Create callback once, reuse for all restarts
	const guardedCallback = createGuardedTimeUpdateCallback(
		get,
		set,
		() => {
			return restartPlaybackRef.current?.() ?? Promise.resolve();
		},
		state,
	);

	// Create restart function for looping support
	restartPlaybackRef.current = async () => {
		const currentTracks = get(tracksAtom);
		const loopRegion = get(loopRegionAtom);
		const startMs = loopRegion.enabled ? loopRegion.startMs : 0;

		await serviceRegistry.playbackService?.pause();
		await serviceRegistry.playbackService?.play(currentTracks, {
			startTime: startMs / 1000,
			onTimeUpdate: guardedCallback,
			onPlaybackEnd: () => {
				const endState = get(playbackAtom);
				safeSet(set, playbackAtom, { ...endState, isPlaying: false }, state);
			},
		});
	};

	// Use the same callback for initial play
	await serviceRegistry.playbackService.play(tracks, {
		startTime: currentTimeSeconds,
		onTimeUpdate: guardedCallback,
		onPlaybackEnd: () => {
			const endState = get(playbackAtom);
			safeSet(set, playbackAtom, { ...endState, isPlaying: false }, state);
		},
	});

	safeSet(set, playbackAtom, { ...playback, isPlaying: true }, state);
});

export const stopPlaybackAtom = atom(null, async (get, set) => {
	const state = { disposed: false, label: "stop" };
	if (!serviceRegistry.playbackService) {
		console.warn("Playback service not registered");
		return;
	}

	await serviceRegistry.playbackService.stop();
	const playback = get(playbackAtom);
	safeSet(set, playbackAtom, { ...playback, isPlaying: false }, state);
});

export const setCurrentTimeAtom = atom(
	null,
	async (get, set, timeMs: number) => {
		const playback = get(playbackAtom);
		const tracks = get(tracksAtom);
		const playbackService = serviceRegistry.playbackService;
		const state = { disposed: false, label: "setCurrentTime" };

		safeSet(set, playbackAtom, { ...playback, currentTime: timeMs }, state);

		// If not playing, notify Transport via playback service seek
		if (!playback.isPlaying) {
			try {
				await playbackService?.seek(timeMs);
			} catch (error) {
				console.warn("Failed to seek transport", error);
			}
			return;
		}

		if (!playbackService) return;

		await playbackService.pause();

		// Hoist callback creation to prevent accumulation on loop restarts
		const restartPlaybackRef = {
			current: null as (() => Promise<void>) | null,
		};

		// Create callback once, reuse for all restarts
		const guardedCallback = createGuardedTimeUpdateCallback(
			get,
			set,
			() => {
				return restartPlaybackRef.current?.() ?? Promise.resolve();
			},
			state,
		);

		// Create restart function for looping support
		restartPlaybackRef.current = async () => {
			const currentTracks = get(tracksAtom);
			const loopRegion = get(loopRegionAtom);
			const startMs = loopRegion.enabled ? loopRegion.startMs : 0;

			await playbackService.pause();
			await playbackService.play(currentTracks, {
				startTime: startMs / 1000,
				onTimeUpdate: guardedCallback,
				onPlaybackEnd: () => {
					const endState = get(playbackAtom);
					safeSet(set, playbackAtom, { ...endState, isPlaying: false }, state);
				},
			});
		};

		// Use the same callback for initial play
		await playbackService.play(tracks, {
			startTime: timeMs / 1000,
			onTimeUpdate: guardedCallback,
			onPlaybackEnd: () => {
				const endState = get(playbackAtom);
				safeSet(set, playbackAtom, { ...endState, isPlaying: false }, state);
			},
		});
	},
);

export const setBpmAtom = atom(null, (get, set, bpm: number) => {
	const playback = get(playbackAtom);
	const clamped = Math.max(30, Math.min(300, Number.isFinite(bpm) ? bpm : 120));
	safeSet(
		set,
		playbackAtom,
		{ ...playback, bpm: clamped },
		{ disposed: false, label: "setBpm" },
	);
});

export const toggleLoopingAtom = atom(null, (get, set) => {
	const playback = get(playbackAtom);
	safeSet(
		set,
		playbackAtom,
		{ ...playback, looping: !playback.looping },
		{ disposed: false, label: "toggleLooping" },
	);
});
