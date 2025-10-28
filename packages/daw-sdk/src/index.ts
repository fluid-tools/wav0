/**
 * WAV0 DAW SDK - Framework-agnostic audio engine
 * @version 0.1.0
 */

export { AudioEngine } from "./core/audio-engine";
// Core classes
export { createDAW, DAW } from "./core/daw";
export { Transport } from "./core/transport";

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
export { audioBuffer } from "./utils/audio-buffer";
export { automation } from "./utils/automation";
export { curves } from "./utils/curves";
// Utilities as namespaces
export { time } from "./utils/time";
export { volume } from "./utils/volume";

export const VERSION = "0.1.0";
