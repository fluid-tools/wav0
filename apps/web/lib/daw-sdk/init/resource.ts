/**
 * React 19 Suspense-based audio initialization
 * Provides a resource that can be consumed with use()
 */

import { audioService } from "../core/audio-service";
import { playbackService } from "../core/playback-service";

let audioReadyPromise: Promise<void> | null = null;

/**
 * Ensure audio context is ready
 * Returns a promise that resolves when audio is initialized
 * Safe to call multiple times - returns the same promise
 */
export function ensureAudioReady(): Promise<void> {
	if (!audioReadyPromise) {
		audioReadyPromise = audioService
			.getAudioContext()
			.then(() => {
				// Optional: warm up playback service
				playbackService.warmup?.();
			})
			.catch((err) => {
				// Reset promise on error so retry is possible
				audioReadyPromise = null;
				throw err;
			});
	}
	return audioReadyPromise;
}
