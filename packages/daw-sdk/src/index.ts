/**
 * WAV0 DAW SDK - Framework-agnostic audio engine
 * @version 0.1.0
 */

export { AudioEngine } from "./core/audio-engine";
// Audio scheduling constants
export {
	AUTOMATION_CANCEL_LOOKAHEAD_SEC,
	AUTOMATION_SCHEDULING_EPSILON_SEC,
	MAX_AUTOMATION_CURVE_DURATION_SEC,
	MIN_AUTOMATION_SEGMENT_DURATION_SEC,
	START_GRACE_SEC,
} from "./core/audio-scheduling-constants";
// Core classes
export { createDAW, DAW } from "./core/daw";
export { OPFSManager } from "./core/opfs-manager";
// Performance & update rate constants
export {
	AUTOMATION_VISUAL_UPDATE_RATE_HZ,
	FRAME_BUDGET_MS,
	METER_DB_CHANGE_THRESHOLD,
	METER_UPDATE_INTERVAL_MS,
	// 30fps tier (meters)
	METER_UPDATE_RATE_HZ,
	// Config object
	PERFORMANCE_CONFIG,
	PLAYHEAD_UPDATE_RATE_HZ,
	// Adaptive throttling
	THROTTLE_FALLBACK_METER_RATE_HZ,
	THROTTLE_FALLBACK_TIME_DISPLAY_RATE_HZ,
	THROTTLE_TRIGGER_COUNT,
	TIME_DISPLAY_CHANGE_THRESHOLD_MS,
	TIME_DISPLAY_UPDATE_INTERVAL_MS,
	// 10Hz tier (text readouts)
	TIME_DISPLAY_UPDATE_RATE_HZ,
	// 60fps tier
	TRANSPORT_TIME_UPDATE_RATE_HZ,
	WAVEFORM_REDRAW_INTERVAL_MS,
	// Waveform
	WAVEFORM_REDRAW_RATE_HZ,
} from "./core/performance-constants";
// Preview Player
export type { PreviewPlayer } from "./core/preview-player";
export { createPreviewPlayer } from "./core/preview-player";
// Renderer
export type { AudioBufferProvider, RenderOptions } from "./core/renderer";
export { renderProjectToAudioBuffer } from "./core/renderer";
export { Transport } from "./core/transport";
// Visual/timeline constants
export {
	DAW_DEFAULT_TRACK_HEIGHT,
	DAW_MAX_TRACK_HEIGHT,
	DAW_MIN_TRACK_HEIGHT,
	DAW_PIXELS_PER_SECOND_AT_ZOOM_1,
	DAW_TIMELINE_HEADER_HEIGHT,
} from "./core/visual-constants";

// Core types
export type * from "./types/core";
export type * from "./types/schemas";

// Schema validators
export {
	AudioFileInfoSchema,
	ClipSchema,
	PlaybackStateSchema,
	TimelineStateSchema,
	TrackEnvelopePointSchema,
	TrackEnvelopeSchema,
	TrackEnvelopeSegmentSchema,
	TrackSchema,
} from "./types/schemas";

// Utilities as namespaces
export { audioBuffer } from "./utils/audio-buffer";
export { automation } from "./utils/automation";
export { curves } from "./utils/curves";
// Audio encoding utilities
export type { AudioFormat } from "./utils/encode";
export { encode, getFileExtension, getMimeType } from "./utils/encode";

// Looping utilities
export type { LoopingPolicy } from "./utils/looping";
export { computeLoopEndMs, DEFAULT_LOOPING_POLICY } from "./utils/looping";
export { time } from "./utils/time";
export { volume } from "./utils/volume";

export const VERSION = "0.1.0";
