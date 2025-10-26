/**
 * WAV0 DAW SDK
 *
 * Modular, type-safe, SDK-level DAW library for web-based audio production.
 * Built with MediaBunny, Zod, and modern web APIs.
 *
 * @module daw-sdk
 */

export type { LoadedAudioTrack } from "./core/audio-service";
// ===== Core Services =====
export { AudioService, audioService } from "./core/audio-service";
export { PlaybackService, playbackService } from "./core/playback-service";
export * from "./hooks/use-clip-inspector";
export * from "./hooks/use-drag-interaction";
export * from "./hooks/use-live-automation-gain";
// ===== React Hooks =====
export * from "./hooks/use-playback-sync";
// ===== State Management =====
export * from "./state";
export type { Coordinates } from "./state/coordinates";
export { coordinatesAtom } from "./state/coordinates";
export { loopRegionAtom } from "./state/timeline";
// ===== Type Schemas & Validation =====
export * from "./types/schemas";
export * from "./utils/automation-utils";
// ===== Utilities =====
export * from "./utils/curve-functions";
export * from "./utils/scale";
export * from "./utils/time-utils";
export * from "./utils/volume-utils";
