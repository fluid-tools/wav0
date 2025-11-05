/**
 * WAV0 DAW SDK - Framework-agnostic audio engine
 * @version 0.1.0
 */

export { AudioEngine } from "./core/audio-engine";
// Core classes
export { createDAW, DAW } from "./core/daw";
export { OPFSManager } from "./core/opfs-manager";
export { Transport } from "./core/transport";

// Audio scheduling constants
export {
	AUTOMATION_CANCEL_LOOKAHEAD_SEC,
	AUTOMATION_SCHEDULING_EPSILON_SEC,
	MIN_AUTOMATION_SEGMENT_DURATION_SEC,
	MAX_AUTOMATION_CURVE_DURATION_SEC,
	START_GRACE_SEC,
} from "./core/audio-scheduling-constants";

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
export { time } from "./utils/time";
export { volume } from "./utils/volume";

export const VERSION = "0.1.0";
