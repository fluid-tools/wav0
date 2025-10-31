/**
 * WAV0 DAW SDK
 *
 * Modular, type-safe, SDK-level DAW library for web-based audio production.
 * Built with MediaBunny, Zod, and modern web APIs.
 *
 * @module daw-sdk
 */

// ===== Core Services =====
export type { LoadedAudioTrack } from "./core/audio-service";
export { AudioService, audioService } from "./core/audio-service";
export { PlaybackService, playbackService } from "./core/playback-service";
// ===== Core Types =====
export * from "./core/types";
// ===== Core Constants =====
export * from "./core/audio-scheduling-constants";

// ===== React Hooks =====
export * from "./hooks/use-clip-inspector";
export * from "./hooks/use-drag-interaction";
export * from "./hooks/use-live-automation-gain";
export * from "./hooks/use-playback-sync";

// ===== State Management =====
export * from "./state";
// ===== Utilities (Pure Functions) =====
// NOTE: Core utils migrated to @wav0/daw-sdk namespaces (time, volume, automation, curves)
// Migration and helper functions remain here temporarily
export * from "./state/automation-migration";
// ===== Type Schemas & Validation =====
export * from "./types/schemas";
export * from "./utils/automation-migration-helpers";
