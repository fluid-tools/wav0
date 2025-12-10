/**
 * Atom Sync Hooks
 * Synchronize Jotai atoms with SDK events using useEffectEvent
 *
 * These hooks bridge the gap between the new event-driven SDK
 * and existing Jotai atom-based state management, enabling
 * gradual migration without breaking components.
 */

"use client";

import type { PlaybackState, Track, TransportEvent } from "@wav0/daw-sdk";
import type { WritableAtom } from "jotai";
import { useSetAtom, useStore } from "jotai";
import { useEffect, useEffectEvent, useRef } from "react";
import { isSeekingAtom } from "../atoms/base";
import { useDAWContext } from "../providers/daw-provider";

/**
 * Sync playback atom with Transport events
 * Updates isPlaying and currentTime based on SDK Transport state
 * Preserves other playback properties (bpm, duration, looping)
 */
export function usePlaybackAtomSync<
	T extends { currentTime: number; isPlaying: boolean },
>(
	playbackAtom: WritableAtom<T, [T | ((prev: T) => T)], void>,
) {
	const setPlayback = useSetAtom(playbackAtom);
	const store = useStore();
	const playbackRef = useRef(store.get(playbackAtom));
	const disposedRef = useRef(false);
	// Debounce timer for isPlaying changes - prevents re-renders during seek (pause→play cycle)
	const isPlayingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const daw = useDAWContext();

	useEffect(() => {
		disposedRef.current = false;
		return store.sub(playbackAtom, () => {
			playbackRef.current = store.get(playbackAtom);
		});
	}, [store, playbackAtom]);
	useEffect(() => {
		return () => {
			disposedRef.current = true;
			// Clean up debounce timer
			if (isPlayingDebounceRef.current) {
				clearTimeout(isPlayingDebounceRef.current);
			}
		};
	}, []);

	// Non-reactive event handler - always reads latest playback state
	// Debounces isPlaying changes to prevent re-renders during rapid seek operations
	const handleTransportEvent = useEffectEvent(
		(event: CustomEvent<TransportEvent>) => {
			const { state, currentTime } = event.detail;
			const newIsPlaying = state === "playing";
			const prevIsPlaying = playbackRef.current.isPlaying;

			// Update ref immediately (for other code that reads playbackRef)
			const nextPlayback = {
				...playbackRef.current,
				isPlaying: newIsPlaying,
				currentTime,
			};
			playbackRef.current = nextPlayback;

			if (disposedRef.current) return;

			// If seeking, ignore Transport events (prevents pause→play re-renders)
			const isSeeking = store.get(isSeekingAtom);
			if (isSeeking) return;

			// If isPlaying didn't change, no need to update atom
			if (newIsPlaying === prevIsPlaying) return;

			// Clear any pending debounce
			if (isPlayingDebounceRef.current) {
				clearTimeout(isPlayingDebounceRef.current);
				isPlayingDebounceRef.current = null;
			}

			// Debounce isPlaying changes by 30ms to filter out seek's pause→play cycle
			isPlayingDebounceRef.current = setTimeout(() => {
				isPlayingDebounceRef.current = null;
				if (disposedRef.current) return;
				// Re-read latest state after debounce period
				const currentState = playbackRef.current;
				try {
					setPlayback(currentState);
				} catch (error) {
					if (!disposedRef.current) {
						console.warn("[usePlaybackAtomSync] setPlayback failed", error);
						disposedRef.current = true;
					}
				}
			}, 30);
		},
	);

	useEffect(() => {
		if (!daw) return;

		const transport = daw.getTransport();

		// Only sync on transport state changes (play/pause/stop/seek)
		// NOT on time-update - that would cause 60fps re-renders
		// Components that need continuous time subscribe directly to Transport
		transport.addEventListener(
			"transport",
			handleTransportEvent as EventListener,
		);

		return () => {
			transport.removeEventListener(
				"transport",
				handleTransportEvent as EventListener,
			);
		};
	}, [daw, handleTransportEvent]);
}

/**
 * Sync tracks atom with AudioEngine events
 * Updates track metadata when audio is loaded
 */
type TrackLoadedDetail = {
	id: string;
	duration: number;
	sampleRate: number;
	numberOfChannels: number;
};

export function useTrackAtomSync(
	tracksAtom: WritableAtom<
		Track[],
		[Track[] | ((prev: Track[]) => Track[])],
		void
	>,
) {
	const setTracks = useSetAtom(tracksAtom);
	const store = useStore();
	const tracksRef = useRef(store.get(tracksAtom));
	const disposedRef = useRef(false);

	useEffect(() => {
		disposedRef.current = false;
		return store.sub(tracksAtom, () => {
			tracksRef.current = store.get(tracksAtom);
		});
	}, [store, tracksAtom]);
	useEffect(() => {
		return () => {
			disposedRef.current = true;
		};
	}, []);
	const daw = useDAWContext();

	// Non-reactive track loaded handler
	const handleTrackLoaded = useEffectEvent(
		(event: CustomEvent<TrackLoadedDetail>) => {
			const { id, duration, sampleRate, numberOfChannels } = event.detail;

			let changed = false;
			const currentTracks = tracksRef.current ?? [];

			const updatedTracks = currentTracks.map((track: Track) => {
				if (track.id !== id) return track;
				changed = true;
				return {
					...track,
					duration,
					sampleRate,
					numberOfChannels,
				};
			});

			if (!changed) return;

			tracksRef.current = updatedTracks;
			if (disposedRef.current) return;
			try {
				setTracks(updatedTracks);
			} catch (error) {
				if (!disposedRef.current) {
					console.warn("[useTrackAtomSync] setTracks failed", error);
					disposedRef.current = true;
				}
			}
		},
	);

	useEffect(() => {
		if (!daw) return;

		const audioEngine = daw.getAudioEngine();

		audioEngine.addEventListener(
			"trackloaded",
			handleTrackLoaded as EventListener,
		);

		return () => {
			audioEngine.removeEventListener(
				"trackloaded",
				handleTrackLoaded as EventListener,
			);
		};
	}, [daw, handleTrackLoaded]);
}

/**
 * Combined sync hook for both playback and tracks
 * Convenience hook to enable both syncs at once
 */
export function useDAWAtomSync(
	playbackAtom: WritableAtom<
		PlaybackState,
		[PlaybackState | ((prev: PlaybackState) => PlaybackState)],
		void
	>,
	tracksAtom: WritableAtom<
		Track[],
		[Track[] | ((prev: Track[]) => Track[])],
		void
	>,
) {
	usePlaybackAtomSync(playbackAtom);
	useTrackAtomSync(tracksAtom);
}
