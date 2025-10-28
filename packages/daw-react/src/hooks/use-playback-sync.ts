/**
 * Playback Sync Hook
 * Synchronize playback state between SDK and Jotai atoms
 */

"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { useTransportEvents } from "./use-transport-events";

/**
 * Atom interface for playback state (to be provided externally)
 */
export interface PlaybackStateAtom {
	isPlaying: boolean;
	currentTime: number;
}

interface UsePlaybackSyncOptions<T extends PlaybackStateAtom> {
	playbackAtom: any; // Jotai atom for playback state
	enabled?: boolean;
}

/**
 * Hook to keep playback state synced between Transport and atoms
 */
export function usePlaybackSync<T extends PlaybackStateAtom>({
	playbackAtom,
	enabled = true,
}: UsePlaybackSyncOptions<T>) {
	const [playbackState, setPlaybackState] = useAtom<T, [T], void>(playbackAtom);

	const handleStateChange = useCallback(
		(state: string, currentTime: number) => {
			if (!enabled) return;

			setPlaybackState({
				...playbackState,
				isPlaying: state === "playing",
				currentTime,
			} as T);
		},
		[enabled, playbackState, setPlaybackState],
	);

	const { transport, getCurrentTime } = useTransportEvents({
		onStateChange: handleStateChange,
	});

	// Periodic time updates during playback
	useEffect(() => {
		if (!enabled || !playbackState.isPlaying) return;

		const interval = setInterval(() => {
			const currentTime = getCurrentTime();
			setPlaybackState({
				...playbackState,
				currentTime,
			} as T);
		}, 16); // ~60fps

		return () => clearInterval(interval);
	}, [enabled, playbackState.isPlaying, getCurrentTime, setPlaybackState]);

	return {
		transport,
		playbackState,
	};
}
