/**
 * WAV0 DAW React - React integration for DAW SDK
 * @version 0.1.0
 */

// Re-export useful types from SDK for convenience
// Re-export looping utilities
export type {
	AudioData,
	AutomationType,
	Clip,
	ClipInspectorTarget,
	LoopingPolicy,
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
// Re-export utils for convenience (so components can import from one place)
// Re-export visual constants
export {
	automation,
	computeLoopEndMs,
	curves,
	DAW_DEFAULT_TRACK_HEIGHT,
	DAW_MAX_TRACK_HEIGHT,
	DAW_MIN_TRACK_HEIGHT,
	DAW_PIXELS_PER_SECOND_AT_ZOOM_1,
	DAW_TIMELINE_HEADER_HEIGHT,
	DEFAULT_LOOPING_POLICY,
	time,
	volume,
} from "@wav0/daw-sdk";

// Atoms
export * from "./atoms";
// Hooks
export * from "./hooks";
// Providers
export {
	DAWProvider,
	type DAWProviderProps,
	useDAWContext,
} from "./providers/daw-provider";
// Storage
export {
	browserAdapter,
	getStorageAdapter,
	memoryAdapter,
	type StorageAdapter,
	setStorageAdapter,
} from "./storage/adapter";

export const VERSION = "0.1.0";
