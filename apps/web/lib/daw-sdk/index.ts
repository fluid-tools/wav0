/**
 * WAV0 DAW SDK - Legacy Compatibility Layer
 *
 * This module re-exports from @wav0/daw-react and @wav0/daw-sdk packages,
 * along with legacy atoms not yet migrated.
 *
 * New code should import directly from @wav0/daw-react instead.
 *
 * @deprecated Use @wav0/daw-react directly for new code
 * @module daw-sdk
 */

// Types
export type {
	AudioData,
	AutomationType,
	Clip,
	ClipInspectorTarget,
	PlaybackOptions,
	PlaybackState,
	ProjectMarker,
	TimelineSection,
	TimelineState,
	Tool,
	Track,
	TrackEnvelope,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
	TransportEvent,
	TransportState,
} from "@wav0/daw-sdk";
// ===== Re-exports from @wav0/daw-sdk =====
// Utilities as namespaces
export { automation, curves, time, volume } from "@wav0/daw-sdk";
// ===== Legacy Audio Scheduling Constants =====
export * from "./core/audio-scheduling-constants";
// ===== Legacy Services (still required during migration) =====
export type { LoadedAudioTrack } from "./core/audio-service";
export { AudioService, audioService } from "./core/audio-service";
export { PlaybackService, playbackService } from "./core/playback-service";
// ===== Legacy Core Types =====
export * from "./core/types";

// ===== Legacy React Hooks =====
export * from "./hooks/use-clip-inspector";
export * from "./hooks/use-drag-interaction";
export * from "./hooks/use-live-automation-gain";
export * from "./hooks/use-playback-sync";

// ===== Legacy State Management (Atoms) =====
// All atoms and write atoms - this is the main export during migration
export * from "./state";

// ===== Legacy Utilities (Migration/Helpers) =====
export * from "./state/automation-migration";
// ===== Legacy Type Schemas (Zod validators) =====
export * from "./types/schemas";
export * from "./utils/automation-migration-helpers";
