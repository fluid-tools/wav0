/**
 * Playback Sync Hook
 * Synchronize playback state between SDK and Jotai atoms
 * Uses useEffectEvent for stable callbacks and optimal performance
 */

"use client";

import type { WritableAtom } from "jotai";
import { useAtom } from "jotai";
import { useEffect, useEffectEvent, useRef } from "react";
import { useTransportEvents } from "./use-transport-events";

/**
 * Atom interface for playback state (to be provided externally)
 */
export interface PlaybackStateAtom {
	isPlaying: boolean;
	currentTime: number;
}

interface UsePlaybackSyncOptions<T extends PlaybackStateAtom> {
	playbackAtom: WritableAtom<T, [T | ((prev: T) => T)], void>;
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
	const lastTimeRef = useRef<number>(0);

	// Non-reactive state change handler - always reads latest playbackState
	const handleStateChange = useEffectEvent(
		(state: string, currentTime: number) => {
			if (!enabled) return;

			setPlaybackState({
				...playbackState,
				isPlaying: state === "playing",
				currentTime,
			} as T);
		},
	);

	const { transport } = useTransportEvents({
		onStateChange: handleStateChange, // Stable reference now
	});

	// Non-reactive time update handler - always reads latest playbackState
	const handleTimeUpdate = useEffectEvent((currentTime: number) => {
		if (!enabled) return;
		// Read latest playbackState through closure
		const latestState = playbackState;
		if (!latestState.isPlaying) return;
		if (Math.abs(latestState.currentTime - currentTime) < 0.5) return;
		if (Math.abs(lastTimeRef.current - currentTime) < 0.5) return;

		lastTimeRef.current = currentTime;

		setPlaybackState({
			...latestState,
			currentTime,
		} as T);
	});

	// Listen for time-update events from Transport (replaces setInterval polling)
	useEffect(() => {
		if (!enabled || !transport) return;

		const eventHandler = ((event: CustomEvent) => {
			const { currentTime } = event.detail;
			handleTimeUpdate(currentTime);
		}) as EventListener;

		transport.addEventListener("time-update", eventHandler);

		return () => {
			transport.removeEventListener("time-update", eventHandler);
		};
	}, [enabled, transport, handleTimeUpdate]);

	// Remove old setInterval-based polling (replaced by event-based updates)
	// useEffect(() => {
	//   if (!enabled) return;
	//   const interval = setInterval(updateTime, 16); // ~60fps
	//   return () => clearInterval(interval);
	// }, [enabled, updateTime]);

	return {
		transport,
		playbackState,
	};
}
