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

// ===== All atoms from @wav0/daw-react =====
export * from "@wav0/daw-react/atoms";
export type { DragState } from "@wav0/daw-react/hooks";
// ===== Hooks from @wav0/daw-react =====
export {
	useClipInspector,
	useDragInteraction,
	useKeyboardShortcut,
	useLiveAutomationGain,
	useTimebase,
} from "@wav0/daw-react/hooks";
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
import {
	automation,
	curves,
	DAW_DEFAULT_TRACK_HEIGHT,
	DAW_MAX_TRACK_HEIGHT,
	DAW_MIN_TRACK_HEIGHT,
	DAW_PIXELS_PER_SECOND_AT_ZOOM_1,
	DAW_TIMELINE_HEADER_HEIGHT,
	time,
	volume,
} from "@wav0/daw-sdk";

export {
	automation,
	curves,
	DAW_DEFAULT_TRACK_HEIGHT,
	DAW_MAX_TRACK_HEIGHT,
	DAW_MIN_TRACK_HEIGHT,
	DAW_PIXELS_PER_SECOND_AT_ZOOM_1,
	DAW_TIMELINE_HEADER_HEIGHT,
	time,
	volume,
};

// ===== Looping Utilities from @wav0/daw-sdk =====
import {
	computeLoopEndMs,
	DEFAULT_LOOPING_POLICY,
} from "@wav0/daw-sdk";
export type { LoopingPolicy } from "@wav0/daw-sdk";
export { computeLoopEndMs, DEFAULT_LOOPING_POLICY };

// ===== Audio Encoding from @wav0/daw-sdk =====
export type { AudioFormat } from "@wav0/daw-sdk";
export { encode, getFileExtension, getMimeType } from "@wav0/daw-sdk";

// ===== Audio Scheduling Constants from @wav0/daw-sdk =====
export {
	AUTOMATION_CANCEL_LOOKAHEAD_SEC,
	AUTOMATION_SCHEDULING_EPSILON_SEC,
	MIN_AUTOMATION_SEGMENT_DURATION_SEC,
	MAX_AUTOMATION_CURVE_DURATION_SEC,
	START_GRACE_SEC,
} from "@wav0/daw-sdk";

// ===== Renderer from @wav0/daw-sdk =====
export type { AudioBufferProvider, RenderOptions } from "@wav0/daw-sdk";
export { renderProjectToAudioBuffer } from "@wav0/daw-sdk";

// ===== Preview Player from @wav0/daw-sdk =====
export type { PreviewPlayer } from "@wav0/daw-sdk";
export { createPreviewPlayer } from "@wav0/daw-sdk";

// ===== Legacy Services (still required during migration) =====
export type { LoadedAudioTrack } from "./core/audio-service";
export { AudioService, audioService } from "./core/audio-service";
export { PlaybackService, playbackService } from "./core/playback-service";
// ===== Legacy Core Types =====
export * from "./core/types";

// ===== Automation Helpers (re-exported from SDK namespace for convenience) =====
// Components import these directly, so we re-export from the automation namespace
export const { migrateAutomationToSegments, resolveClipRelativePoint } =
	automation;

// ===== Legacy Utilities (still used by some components) =====
// TODO: Migrate consumers to use automation.* directly then remove these
export {
	addAutomationPoint,
	bindEnvelopeToClips,
	computeAutomationTransfer,
	mergeAutomationPoints,
	removeAutomationPoint,
	updateSegmentCurve,
} from "./utils/automation-migration-helpers";
