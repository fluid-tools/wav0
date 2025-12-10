/**
 * Unified interaction state machine for track content interactions
 * Handles: clip drag, clip resize (start/end), loop point drag
 */
import { assign, setup } from "xstate";

// Interaction context - union of all possible interaction data
export type InteractionContext = {
	// Common fields
	trackId: string | null;
	clipId: string | null;
	startX: number;
	startY: number;

	// Clip drag specific
	startTime: number;
	originalTrackIndex: number;
	sourceTrackId: string | null;
	previewTrackId: string | null;
	previewStartTime: number;
	cursorOffsetX: number;
	cursorOffsetY: number;
	startScrollLeft: number; // Scroll position at drag start for scroll compensation

	// Resize specific
	resizeType: "start" | "end" | null;
	startTrimStart: number;
	startTrimEnd: number;
	startClipStartTime: number;

	// Loop drag specific
	startLoopEnd: number | undefined;
};

const initialContext: InteractionContext = {
	trackId: null,
	clipId: null,
	startX: 0,
	startY: 0,
	startTime: 0,
	originalTrackIndex: -1,
	sourceTrackId: null,
	previewTrackId: null,
	previewStartTime: 0,
	cursorOffsetX: 0,
	cursorOffsetY: 0,
	startScrollLeft: 0,
	resizeType: null,
	startTrimStart: 0,
	startTrimEnd: 0,
	startClipStartTime: 0,
	startLoopEnd: undefined,
};

export type InteractionEvent =
	| {
			type: "START_CLIP_DRAG";
			trackId: string;
			clipId: string;
			startX: number;
			startY: number;
			startTime: number;
			originalTrackIndex: number;
			offsetX: number;
			offsetY: number;
			startScrollLeft: number;
	  }
	| {
			type: "START_RESIZE";
			trackId: string;
			clipId: string;
			resizeType: "start" | "end";
			startX: number;
			startTrimStart: number;
			startTrimEnd: number;
			startClipStartTime: number;
	  }
	| {
			type: "START_LOOP_DRAG";
			trackId: string;
			clipId: string;
			startX: number;
			startLoopEnd: number | undefined;
	  }
	| {
			type: "MOVE";
			previewTrackId?: string;
			previewStartTime?: number;
			x?: number;
			y?: number;
	  }
	| { type: "COMMIT" }
	| { type: "CANCEL" };

export const interactionMachine = setup({
	types: {
		context: {} as InteractionContext,
		events: {} as InteractionEvent,
	},
}).createMachine({
	id: "interaction",
	initial: "idle",
	context: initialContext,
	states: {
		idle: {
			on: {
				START_CLIP_DRAG: {
					target: "draggingClip",
					actions: assign({
						trackId: ({ event }) => event.trackId,
						clipId: ({ event }) => event.clipId,
						startX: ({ event }) => event.startX,
						startY: ({ event }) => event.startY,
						startTime: ({ event }) => event.startTime,
						originalTrackIndex: ({ event }) => event.originalTrackIndex,
						sourceTrackId: ({ event }) => event.trackId,
						previewTrackId: ({ event }) => event.trackId,
						previewStartTime: ({ event }) => event.startTime,
						cursorOffsetX: ({ event }) => event.offsetX,
						cursorOffsetY: ({ event }) => event.offsetY,
						startScrollLeft: ({ event }) => event.startScrollLeft,
					}),
				},
				START_RESIZE: {
					target: "resizingClip",
					actions: assign({
						trackId: ({ event }) => event.trackId,
						clipId: ({ event }) => event.clipId,
						resizeType: ({ event }) => event.resizeType,
						startX: ({ event }) => event.startX,
						startTrimStart: ({ event }) => event.startTrimStart,
						startTrimEnd: ({ event }) => event.startTrimEnd,
						startClipStartTime: ({ event }) => event.startClipStartTime,
					}),
				},
				START_LOOP_DRAG: {
					target: "draggingLoop",
					actions: assign({
						trackId: ({ event }) => event.trackId,
						clipId: ({ event }) => event.clipId,
						startX: ({ event }) => event.startX,
						startLoopEnd: ({ event }) => event.startLoopEnd,
					}),
				},
			},
		},
		draggingClip: {
			on: {
				MOVE: {
					actions: assign({
						previewTrackId: ({ context, event }) =>
							event.previewTrackId ?? context.previewTrackId,
						previewStartTime: ({ context, event }) =>
							event.previewStartTime ?? context.previewStartTime,
					}),
				},
				COMMIT: { target: "committing" },
				CANCEL: { target: "idle", actions: assign(initialContext) },
			},
		},
		resizingClip: {
			on: {
				MOVE: {
					// Resize doesn't need to update context - component reads mouse position directly
				},
				COMMIT: { target: "committing" },
				CANCEL: { target: "idle", actions: assign(initialContext) },
			},
		},
		draggingLoop: {
			on: {
				MOVE: {
					// Loop drag doesn't need to update context - component reads mouse position directly
				},
				COMMIT: { target: "committing" },
				CANCEL: { target: "idle", actions: assign(initialContext) },
			},
		},
		committing: {
			// Transient state - immediately resets to idle
			// The component handles the actual commit logic before sending COMMIT
			always: {
				target: "idle",
				actions: assign(initialContext),
			},
		},
	},
});

// Helper type for interaction state
export type InteractionState =
	| "idle"
	| "draggingClip"
	| "resizingClip"
	| "draggingLoop"
	| "committing";

