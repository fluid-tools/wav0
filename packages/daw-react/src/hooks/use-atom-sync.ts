/**
 * Atom Sync Hooks
 * Synchronize Jotai atoms with SDK events using useEffectEvent
 * 
 * These hooks bridge the gap between the new event-driven SDK
 * and existing Jotai atom-based state management, enabling
 * gradual migration without breaking components.
 */

"use client";

import { useEffect, useEffectEvent } from "react";
import { useAtom } from "jotai";
import type { WritableAtom } from "jotai";
import { useDAWContext } from "../providers/daw-provider";
import type { TransportEvent } from "@wav0/daw-sdk";

/**
 * Sync playback atom with Transport events
 * Updates isPlaying and currentTime based on SDK Transport state
 * Preserves other playback properties (bpm, duration, looping)
 */
export function usePlaybackAtomSync(
	playbackAtom: WritableAtom<any, [any], void>,
) {
	const [playback, setPlayback] = useAtom(playbackAtom);
	const daw = useDAWContext();

	// Non-reactive event handler - always reads latest playback state
	const handleTransportEvent = useEffectEvent((event: CustomEvent<TransportEvent>) => {
		const { state, currentTime } = event.detail;
		
		// Preserve other properties while updating from Transport
		setPlayback({
			...playback,
			isPlaying: state === "playing",
			currentTime,
		});
	});

	useEffect(() => {
		if (!daw) return;

		const transport = daw.getTransport();

		transport.addEventListener("transport", handleTransportEvent as EventListener);

		return () => {
			transport.removeEventListener("transport", handleTransportEvent as EventListener);
		};
	}, [daw, handleTransportEvent]);
}

/**
 * Sync tracks atom with AudioEngine events
 * Updates track metadata when audio is loaded
 */
export function useTrackAtomSync(
	tracksAtom: WritableAtom<any, [any], void>,
) {
	const [tracks, setTracks] = useAtom(tracksAtom);
	const daw = useDAWContext();

	// Non-reactive track loaded handler
	const handleTrackLoaded = useEffectEvent((event: CustomEvent<any>) => {
		const { id, duration, sampleRate, numberOfChannels } = event.detail;

		// Update tracks atom with new audio info
		const updatedTracks = tracks.map((track: any) =>
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
	});

	useEffect(() => {
		if (!daw) return;

		const audioEngine = daw.getAudioEngine();

		audioEngine.addEventListener("trackloaded", handleTrackLoaded as EventListener);

		return () => {
			audioEngine.removeEventListener("trackloaded", handleTrackLoaded as EventListener);
		};
	}, [daw, handleTrackLoaded]);
}

/**
 * Combined sync hook for both playback and tracks
 * Convenience hook to enable both syncs at once
 */
export function useDAWAtomSync(
	playbackAtom: WritableAtom<any, [any], void>,
	tracksAtom: WritableAtom<any, [any], void>,
) {
	usePlaybackAtomSync(playbackAtom);
	useTrackAtomSync(tracksAtom);
}

