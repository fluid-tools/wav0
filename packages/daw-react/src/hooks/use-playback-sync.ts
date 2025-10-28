/**
 * Playback Sync Hook
 * Synchronize playback state between SDK and Jotai atoms
 * Uses useEffectEvent for stable callbacks and optimal performance
 */

"use client";

import { useAtom } from "jotai";
import { useEffect, useEffectEvent } from "react";
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
 * Performance optimized with useEffectEvent to avoid recreating callbacks
 */
export function usePlaybackSync<T extends PlaybackStateAtom>({
	playbackAtom,
	enabled = true,
}: UsePlaybackSyncOptions<T>) {
	const [playbackState, setPlaybackState] = useAtom<T, [T], void>(playbackAtom);

	// Non-reactive state change handler - always reads latest playbackState
	const handleStateChange = useEffectEvent((state: string, currentTime: number) => {
		if (!enabled) return;

		setPlaybackState({
			...playbackState,
			isPlaying: state === "playing",
			currentTime,
		} as T);
	});

	// Non-reactive time updater - always reads latest values
	const updateTime = useEffectEvent(() => {
		if (!playbackState.isPlaying || !enabled) return;

		const currentTime = getCurrentTime();
		setPlaybackState({
			...playbackState,
			currentTime,
		} as T);
	});

	const { transport, getCurrentTime } = useTransportEvents({
		onStateChange: handleStateChange, // Stable reference now
	});

	// Single stable interval - only recreates when enabled changes
	useEffect(() => {
		if (!enabled) return;

		const interval = setInterval(updateTime, 16); // ~60fps

		return () => clearInterval(interval);
	}, [enabled, updateTime]); // Minimal, stable dependencies

	return {
		transport,
		playbackState,
	};
}
