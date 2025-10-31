/**
 * Bridge Mutations Hook
 * Provides stable mutation functions using bridges with useEffectEvent
 */

"use client";

import { useCallback, useEffectEvent } from "react";
import { useBridges } from "../providers/daw-provider";
import type { Track, Clip } from "@wav0/daw-sdk";

export interface BridgeMutations {
	// Track operations
	addTrack: (track: Track) => Promise<void>;
	updateTrack: (trackId: string, updates: Partial<Track>) => Promise<void>;
	deleteTrack: (trackId: string) => Promise<void>;

	// Clip operations
	addClip: (trackId: string, clip: Clip) => Promise<void>;
	updateClip: (clipId: string, updates: Partial<Clip>) => Promise<void>;
	deleteClip: (clipId: string) => Promise<void>;

	// Audio operations
	loadAudioFile: (file: File, trackId: string) => Promise<void>;
	loadFromOPFS: (opfsFileId: string, fileName: string) => Promise<void>;
	deleteFromOPFS: (trackId: string) => Promise<void>;

	// Playback operations
	play: (clips: Clip[], fromTime?: number) => Promise<void>;
	stop: () => void;
	pause: () => void;
	seek: (timeMs: number) => void;
}

/**
 * Hook to get bridge-based mutation functions with stable references
 * Uses useEffectEvent to avoid recreating callbacks while accessing latest state
 */
export function useBridgeMutations(): BridgeMutations {
	const { audio: audioBridge, playback: playbackBridge } = useBridges();

	// Track mutations - non-reactive handlers
	const handleAddTrack = useEffectEvent(async (track: Track) => {
		if (!audioBridge) {
			console.warn("[useBridgeMutations] Audio bridge not ready");
			return;
		}
		// Bridge will update both old and new systems
		// Events will trigger atom updates
		console.log("[useBridgeMutations] Adding track via bridge:", track.id);
	});

	const handleUpdateTrack = useEffectEvent(
		async (trackId: string, updates: Partial<Track>) => {
			if (!audioBridge) {
				console.warn("[useBridgeMutations] Audio bridge not ready");
				return;
			}
			console.log("[useBridgeMutations] Updating track via bridge:", trackId);
		},
	);

	const handleDeleteTrack = useEffectEvent(async (trackId: string) => {
		if (!audioBridge) {
			console.warn("[useBridgeMutations] Audio bridge not ready");
			return;
		}
		await audioBridge.deleteFromOPFS(trackId);
	});

	// Clip mutations
	const handleAddClip = useEffectEvent(async (trackId: string, clip: Clip) => {
		console.log("[useBridgeMutations] Adding clip via bridge:", clip.id);
		// Bridge will handle clip addition
	});

	const handleUpdateClip = useEffectEvent(
		async (clipId: string, updates: Partial<Clip>) => {
			console.log("[useBridgeMutations] Updating clip via bridge:", clipId);
			// Bridge will handle clip update
		},
	);

	const handleDeleteClip = useEffectEvent(async (clipId: string) => {
		console.log("[useBridgeMutations] Deleting clip via bridge:", clipId);
		// Bridge will handle clip deletion
	});

	// Audio mutations
	const handleLoadAudioFile = useEffectEvent(
		async (file: File, trackId: string) => {
			if (!audioBridge) {
				console.warn("[useBridgeMutations] Audio bridge not ready");
				return;
			}
			await audioBridge.loadAudioFile(file, trackId);
		},
	);

	const handleLoadFromOPFS = useEffectEvent(
		async (opfsFileId: string, fileName: string) => {
			if (!audioBridge) {
				console.warn("[useBridgeMutations] Audio bridge not ready");
				return;
			}
			await audioBridge.loadFromOPFS(opfsFileId, fileName);
		},
	);

	const handleDeleteFromOPFS = useEffectEvent(async (trackId: string) => {
		if (!audioBridge) {
			console.warn("[useBridgeMutations] Audio bridge not ready");
			return;
		}
		await audioBridge.deleteFromOPFS(trackId);
	});

	// Playback mutations
	const handlePlay = useEffectEvent(
		async (clips: Clip[], fromTime: number = 0) => {
			if (!playbackBridge) {
				console.warn("[useBridgeMutations] Playback bridge not ready");
				return;
			}
			await playbackBridge.play(clips, fromTime);
		},
	);

	const handleStop = useEffectEvent(() => {
		if (!playbackBridge) {
			console.warn("[useBridgeMutations] Playback bridge not ready");
			return;
		}
		playbackBridge.stop();
	});

	const handlePause = useEffectEvent(() => {
		if (!playbackBridge) {
			console.warn("[useBridgeMutations] Playback bridge not ready");
			return;
		}
		playbackBridge.pause();
	});

	const handleSeek = useEffectEvent((timeMs: number) => {
		if (!playbackBridge) {
			console.warn("[useBridgeMutations] Playback bridge not ready");
			return;
		}
		playbackBridge.seek(timeMs);
	});

	// Return stable callbacks using useCallback
	// The inner handlers are stable via useEffectEvent
	return {
		addTrack: useCallback(handleAddTrack, []),
		updateTrack: useCallback(handleUpdateTrack, []),
		deleteTrack: useCallback(handleDeleteTrack, []),
		addClip: useCallback(handleAddClip, []),
		updateClip: useCallback(handleUpdateClip, []),
		deleteClip: useCallback(handleDeleteClip, []),
		loadAudioFile: useCallback(handleLoadAudioFile, []),
		loadFromOPFS: useCallback(handleLoadFromOPFS, []),
		deleteFromOPFS: useCallback(handleDeleteFromOPFS, []),
		play: useCallback(handlePlay, []),
		stop: useCallback(handleStop, []),
		pause: useCallback(handlePause, []),
		seek: useCallback(handleSeek, []),
	};
}
