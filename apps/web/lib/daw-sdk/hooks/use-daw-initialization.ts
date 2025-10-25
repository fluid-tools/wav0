"use client";

import { use, useEffect } from "react";
import { audioService } from "../core/audio-service";
import { playbackService } from "../core/playback-service";
import { ensureAudioReady } from "../init/resource";

/**
 * React 19 audio initialization gate using Suspense
 * Use this component wrapped in <Suspense> to block rendering until audio is ready
 */
export function AudioInitGate() {
	use(ensureAudioReady());
	console.log("[DAW SDK] Initialized successfully");
	return null;
}

/**
 * Legacy hook-based initialization for backward compatibility
 * Prefer using AudioInitGate with Suspense instead
 * @deprecated Use AudioInitGate with Suspense
 */
export function useDAWInitialization() {
	// For backward compatibility, wrap the resource in a hook
	const _init = use(ensureAudioReady());

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			Promise.all([audioService.cleanup(), playbackService.cleanup()]).catch(
				(err) => {
					console.error("[DAW SDK] Cleanup failed:", err);
				},
			);
		};
	}, []);

	return { isInitialized: true, error: null };
}
