/**
 * Hook exports
 */

export {
	useDAWAtomSync,
	usePlaybackAtomSync,
	useTrackAtomSync,
} from "./use-atom-sync";
export type { UseAudioEventsOptions } from "./use-audio-events";
export { useAudioEvents } from "./use-audio-events";
export {
	type BridgeMutations,
	useBridgeMutations,
} from "./use-bridge-mutations";
// Inspector hooks
export { useClipInspector } from "./use-clip-inspector";
export { useDAW } from "./use-daw";
export type { DragState } from "./use-drag-interaction";
// Interaction hooks
export {
	useDragInteraction,
	useKeyboardShortcut,
} from "./use-drag-interaction";
// Automation hooks
export { useLiveAutomationGain } from "./use-live-automation-gain";
export { usePlaybackSync } from "./use-playback-sync";
// Timebase hooks
export { useTimebase } from "./use-timebase";
export {
	type UseTrackInteractionsReturn,
	useTrackInteractions,
} from "./use-track-interactions";
export type { UseTransportEventsOptions } from "./use-transport-events";
export { useTransportEvents } from "./use-transport-events";
