/**
 * UI state atoms - selection, tools, inspector, drag machine
 */

"use client";

import type {
	AutomationType,
	Tool,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
} from "@wav0/daw-sdk";
import { atom } from "jotai";
import { atomWithMachine } from "jotai-xstate";
import {
	activeToolAtom,
	automationViewEnabledAtom,
	clipInspectorOpenAtom,
	clipInspectorTargetAtom,
	eventListOpenAtom,
	projectNameAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	trackAutomationTypeAtom,
	trackHeightZoomAtom,
} from "./base";
import { dragMachine } from "./machines/drag-machine";
import {
	type InteractionContext,
	type InteractionState,
	interactionMachine,
} from "./machines/interaction-machine";

export const setSelectedTrackAtom = atom(
	null,
	(_get, set, trackId: string | null) => {
		set(selectedTrackIdAtom, trackId);
	},
);

export const setSelectedClipAtom = atom(
	null,
	(_get, set, clipId: string | null) => {
		set(selectedClipIdAtom, clipId);
	},
);

export const setClipInspectorOpenAtom = atom(
	null,
	(_get, set, open: boolean) => {
		set(clipInspectorOpenAtom, open);
	},
);

export const setClipInspectorTargetAtom = atom(
	null,
	(_get, set, target: { trackId: string; clipId: string } | null) => {
		set(clipInspectorTargetAtom, target);
	},
);

export const setEventListOpenAtom = atom(null, (_get, set, open: boolean) => {
	set(eventListOpenAtom, open);
});

export const setActiveToolAtom = atom(null, (_get, set, tool: Tool) => {
	set(activeToolAtom, tool);
});

export const toggleAutomationViewAtom = atom(null, (get, set) => {
	const current = get(automationViewEnabledAtom);
	set(automationViewEnabledAtom, !current);
});

export const setTrackHeightZoomAtom = atom(null, (_get, set, zoom: number) => {
	set(trackHeightZoomAtom, Math.max(0.6, Math.min(2.0, zoom)));
});

export const setTrackAutomationTypeAtom = atom(
	null,
	(get, set, trackId: string, type: AutomationType) => {
		const current = new Map(get(trackAutomationTypeAtom));
		current.set(trackId, type);
		set(trackAutomationTypeAtom, current);
	},
);

export const setProjectNameAtom = atom(null, (_get, set, name: string) => {
	const trimmed = name.trim();
	if (!trimmed) return;
	set(projectNameAtom, trimmed);
});

/**
 * Drag state machine atom (XState-powered)
 */
export const dragMachineAtom = atomWithMachine(() => dragMachine);

/**
 * Read-only drag preview atom derived from machine state
 */
export const dragPreviewAtom = atom((get) => {
	const snapshot = get(dragMachineAtom);
	const { context, value } = snapshot;

	if (value === "idle" || !context.clipId) {
		return null;
	}

	return {
		clipId: context.clipId,
		originalTrackId: context.originTrackId ?? "",
		originalStartTime: context.originStartTime,
		previewTrackId: context.previewTrackId ?? "",
		previewStartTime: context.previewStartTime,
		cursorOffsetX: context.cursorOffsetX,
		cursorOffsetY: context.cursorOffsetY,
	};
});

/**
 * Undo history for clip moves (for toast undo functionality)
 */
export const clipMoveHistoryAtom = atom<
	Array<{
		clipId: string;
		fromTrackId: string;
		toTrackId: string;
		fromStartTime: number;
		toStartTime: number;
		automationData: {
			points: TrackEnvelopePoint[];
			segments: TrackEnvelopeSegment[];
		} | null;
		timestamp: number;
	}>
>([]);

/**
 * Unified interaction state machine (replaces local useState in components)
 * Handles: clip drag, clip resize, loop point drag
 */
export const interactionMachineAtom = atomWithMachine(() => interactionMachine);

/**
 * Current interaction state (idle, draggingClip, resizingClip, draggingLoop)
 */
export const interactionStateAtom = atom<InteractionState>((get) => {
	const snapshot = get(interactionMachineAtom);
	return snapshot.value as InteractionState;
});

/**
 * Current interaction context (all data for current interaction)
 */
export const interactionContextAtom = atom<InteractionContext>((get) => {
	const snapshot = get(interactionMachineAtom);
	return snapshot.context;
});

/**
 * Is any interaction currently active?
 */
export const isInteractionActiveAtom = atom<boolean>((get) => {
	const state = get(interactionStateAtom);
	return state !== "idle";
});

/**
 * Clip drag preview (derived from interaction machine when dragging clip)
 */
export const clipDragPreviewAtom = atom((get) => {
	const state = get(interactionStateAtom);
	const context = get(interactionContextAtom);

	if (state !== "draggingClip" || !context.clipId) {
		return null;
	}

	return {
		clipId: context.clipId,
		originalTrackId: context.sourceTrackId ?? "",
		originalStartTime: context.startTime,
		previewTrackId: context.previewTrackId ?? "",
		previewStartTime: context.previewStartTime,
		cursorOffsetX: context.cursorOffsetX,
		cursorOffsetY: context.cursorOffsetY,
	};
});

/**
 * Resize interaction data (derived from interaction machine when resizing)
 */
export const resizeInteractionAtom = atom((get) => {
	const state = get(interactionStateAtom);
	const context = get(interactionContextAtom);

	if (state !== "resizingClip" || !context.clipId) {
		return null;
	}

	return {
		trackId: context.trackId ?? "",
		clipId: context.clipId,
		type: context.resizeType as "start" | "end",
		startX: context.startX,
		startTrimStart: context.startTrimStart,
		startTrimEnd: context.startTrimEnd,
		startClipStartTime: context.startClipStartTime,
	};
});

/**
 * Loop drag interaction data (derived from interaction machine when dragging loop)
 */
export const loopDragInteractionAtom = atom((get) => {
	const state = get(interactionStateAtom);
	const context = get(interactionContextAtom);

	if (state !== "draggingLoop" || !context.clipId) {
		return null;
	}

	return {
		trackId: context.trackId ?? "",
		clipId: context.clipId,
		startX: context.startX,
		startLoopEnd: context.startLoopEnd,
	};
});
