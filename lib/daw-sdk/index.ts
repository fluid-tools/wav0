/**
 * WAV0 DAW SDK
 * 
 * Modular, type-safe, SDK-level DAW library for web-based audio production.
 * Built with MediaBunny, Zod, and modern web APIs.
 * 
 * @module daw-sdk
 */

// ===== Core Services =====
export { audioService, AudioService } from "./core/audio-service"
export { playbackService, PlaybackService } from "./core/playback-service"
export type { LoadedAudioTrack } from "./core/audio-service"

// ===== Type Schemas & Validation =====
export * from "./types/schemas"

// ===== Utilities =====
export * from "./utils/curve-functions"
export * from "./utils/time-utils"
export * from "./utils/volume-utils"
export * from "./utils/automation-utils"

// ===== React Hooks =====
export * from "./hooks/use-playback-sync"
export * from "./hooks/use-drag-interaction"

/**
 * Legacy initialization (use useDAWInitialization hook instead)
 * @deprecated Use `useDAWInitialization()` hook in your root component
 */
export async function initializeDAW(): Promise<void> {
	const { audioService: audio } = await import("./core/audio-service")
	await audio.getAudioContext()
	console.log("[DAW SDK] Initialized successfully")
}

/**
 * Legacy cleanup (automatically handled by useDAWInitialization hook)
 * @deprecated Cleanup is automatic when using the hook
 */
export async function cleanupDAW(): Promise<void> {
	const [{ audioService: audio }, { playbackService: playback }] = await Promise.all([
		import("./core/audio-service"),
		import("./core/playback-service"),
	])
	
	await Promise.all([
		audio.cleanup(),
		playback.cleanup(),
	])
	console.log("[DAW SDK] Cleanup complete")
}
