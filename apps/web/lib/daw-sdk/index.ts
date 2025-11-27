/**
 * WAV0 DAW SDK - Legacy Compatibility Layer
 *
 * This module re-exports from @wav0/daw-react and @wav0/daw-sdk packages,
 * along with legacy services that haven't been fully migrated.
 *
 * New code should import directly from @wav0/daw-react instead.
 *
 * @deprecated Use @wav0/daw-react directly for new code
 * @module daw-sdk
 */

// ===== Types from @wav0/daw-sdk =====
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

// ===== Utilities from @wav0/daw-sdk =====
export { automation, curves, time, volume } from "@wav0/daw-sdk";

// ===== Constants from @wav0/daw-sdk =====
export {
	DAW_PIXELS_PER_SECOND_AT_ZOOM_1,
	DAW_TIMELINE_HEADER_HEIGHT,
	DAW_DEFAULT_TRACK_HEIGHT,
	DAW_MIN_TRACK_HEIGHT,
	DAW_MAX_TRACK_HEIGHT,
} from "@wav0/daw-sdk";

// ===== All atoms from @wav0/daw-react =====
export * from "@wav0/daw-react/atoms";

// ===== Hooks from @wav0/daw-react =====
export {
	useDragInteraction,
	useKeyboardShortcut,
	useClipInspector,
	useLiveAutomationGain,
	useTimebase,
} from "@wav0/daw-react/hooks";
export type { DragState } from "@wav0/daw-react/hooks";

// ===== Legacy Services (still required during migration) =====
export type { LoadedAudioTrack } from "./core/audio-service";
export { AudioService, audioService } from "./core/audio-service";
export { PlaybackService, playbackService } from "./core/playback-service";

// ===== Legacy Core Types =====
export * from "./core/types";

// ===== Legacy Audio Scheduling Constants (some may duplicate SDK) =====
export * from "./core/audio-scheduling-constants";

// ===== Legacy Utilities (Migration/Helpers) =====
// These helpers are still used by some components
export * from "./state/automation-migration";
export * from "./utils/automation-migration-helpers";

// ===== Legacy Type Schemas (Zod validators) =====
export * from "./types/schemas";
