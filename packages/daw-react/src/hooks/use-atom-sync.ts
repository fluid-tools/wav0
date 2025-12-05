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
import { useAtom } from "jotai";
import { useEffect, useEffectEvent } from "react";
import { useDAWContext } from "../providers/daw-provider";

/**
 * Sync playback atom with Transport events
 * Updates isPlaying and currentTime based on SDK Transport state
 * Preserves other playback properties (bpm, duration, looping)
 */
export function usePlaybackAtomSync<T extends { currentTime: number }>(
	playbackAtom: WritableAtom<T, [T | ((prev: T) => T)], void>,
) {
	const [playback, setPlayback] = useAtom(playbackAtom);
	const daw = useDAWContext();

	// Non-reactive event handler - always reads latest playback state
	const handleTransportEvent = useEffectEvent(
		(event: CustomEvent<TransportEvent>) => {
			const { state, currentTime } = event.detail;

			// Preserve other properties while updating from Transport
			setPlayback({
				...playback,
				isPlaying: state === "playing",
				currentTime,
			});
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
	const [tracks, setTracks] = useAtom(tracksAtom);
	const daw = useDAWContext();

	// Non-reactive track loaded handler
	const handleTrackLoaded = useEffectEvent(
		(event: CustomEvent<TrackLoadedDetail>) => {
			const { id, duration, sampleRate, numberOfChannels } = event.detail;

			// Update tracks atom with new audio info
			const updatedTracks = tracks.map((track: Track) =>
				track.id === id
					? {
							...track,
							duration,
							sampleRate,
							numberOfChannels,
						}
					: track,
			);

			setTracks(updatedTracks);
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
