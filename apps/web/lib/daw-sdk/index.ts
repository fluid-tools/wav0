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

// ===== React Hooks =====
export * from "./hooks/use-clip-inspector";
export * from "./hooks/use-drag-interaction";
export * from "./hooks/use-live-automation-gain";
export * from "./hooks/use-playback-sync";

// ===== State Management =====
export * from "./state";

// ===== Type Schemas & Validation =====
export * from "./types/schemas";

// ===== Utilities (Pure Functions) =====
export * from "./utils/automation-utils";
export * from "./utils/curve-functions";
export * from "./utils/time-utils";
export * from "./utils/volume-utils";
