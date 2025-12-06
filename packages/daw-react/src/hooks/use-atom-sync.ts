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
import { useDAWContext } from "../providers/daw-provider";

/**
 * Sync playback atom with Transport events
 * Updates isPlaying and currentTime based on SDK Transport state
 * Preserves other playback properties (bpm, duration, looping)
 */
export function usePlaybackAtomSync<T extends { currentTime: number }>(
	playbackAtom: WritableAtom<T, [T | ((prev: T) => T)], void>,
) {
	const setPlayback = useSetAtom(playbackAtom);
	const store = useStore();
	const playbackRef = useRef(store.get(playbackAtom));
	const disposedRef = useRef(false);

	useEffect(() => {
		disposedRef.current = false;
		return store.sub(playbackAtom, () => {
			playbackRef.current = store.get(playbackAtom);
		});
	}, [store, playbackAtom]);
	useEffect(() => {
		return () => {
			disposedRef.current = true;
		};
	}, []);
	const daw = useDAWContext();

	// Non-reactive event handler - always reads latest playback state
	const handleTransportEvent = useEffectEvent(
		(event: CustomEvent<TransportEvent>) => {
			const { state, currentTime } = event.detail;

			const nextPlayback = {
				...playbackRef.current,
				isPlaying: state === "playing",
				currentTime,
			};
			playbackRef.current = nextPlayback;
			if (disposedRef.current) return;
			try {
				setPlayback(nextPlayback);
			} catch (error) {
				if (!disposedRef.current) {
					console.warn("[usePlaybackAtomSync] setPlayback failed", error);
					disposedRef.current = true;
				}
			}
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
