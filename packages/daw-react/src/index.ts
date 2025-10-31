/**
 * WAV0 DAW React - React integration for DAW SDK
 * @version 0.1.0
 */

// Re-export useful types and utils from SDK for convenience
export type {
	AudioData,
	Clip,
	Track,
	TrackEnvelope,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
	TransportEvent,
	TransportState,
} from "@wav0/daw-sdk";
// Re-export utils for convenience (so components can import from one place)
export { automation, curves, time, volume } from "@wav0/daw-sdk";

// Atoms
export * from "./atoms";
// Bridges (for migration)
export { AudioServiceBridge, PlaybackServiceBridge } from "./bridges";
// Hooks
export * from "./hooks";
// Providers
export {
	DAWProvider,
	type DAWProviderProps,
	useBridges,
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
