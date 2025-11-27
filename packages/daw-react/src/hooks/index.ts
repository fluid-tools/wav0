/**
 * Hook exports
 */

export type { UseAudioEventsOptions } from "./use-audio-events";
export { useAudioEvents } from "./use-audio-events";
export { useDAW } from "./use-daw";
export { usePlaybackSync } from "./use-playback-sync";
export {
	useBridgeMutations,
	type BridgeMutations,
} from "./use-bridge-mutations";
export {
	usePlaybackAtomSync,
	useTrackAtomSync,
	useDAWAtomSync,
} from "./use-atom-sync";

export type { UseTransportEventsOptions } from "./use-transport-events";
export { useTransportEvents } from "./use-transport-events";

// Interaction hooks
export { useDragInteraction, useKeyboardShortcut } from "./use-drag-interaction";
export type { DragState } from "./use-drag-interaction";

// Inspector hooks
export { useClipInspector } from "./use-clip-inspector";

// Automation hooks
export { useLiveAutomationGain } from "./use-live-automation-gain";

// Timebase hooks
export { useTimebase } from "./use-timebase";
