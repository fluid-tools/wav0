/**
 * Audio Engine Event Hook
 * Subscribe to AudioEngine events (track loading, etc.)
 */

"use client";

import type { AudioData } from "@wav0/daw-sdk";
import { useEffect } from "react";
import { useDAWContext } from "../providers/daw-provider";

export interface UseAudioEventsOptions {
	onTrackLoaded?: (audioId: string, audioData: AudioData) => void;
}

/**
 * Hook to listen to AudioEngine events
 * Automatically cleans up listeners on unmount
 */
export function useAudioEvents(options: UseAudioEventsOptions = {}) {
	const daw = useDAWContext();

	useEffect(() => {
		if (!daw) return;

		const audioEngine = daw.getAudioEngine();

		const handleTrackLoaded = ((
			event: CustomEvent<{ audioId: string; audioData: AudioData }>,
		) => {
			const { audioId, audioData } = event.detail;
			options.onTrackLoaded?.(audioId, audioData);
		}) as EventListener;

		audioEngine.addEventListener("trackloaded", handleTrackLoaded);

		return () => {
			audioEngine.removeEventListener("trackloaded", handleTrackLoaded);
		};
	}, [daw, options.onTrackLoaded]);

	return {
		audioEngine: daw?.getAudioEngine() ?? null,
	};
}
