import { assign, setup } from "xstate";

type DragContext = {
	clipId: string | null;
	originTrackId: string | null;
	originStartTime: number;
	previewTrackId: string | null;
	previewStartTime: number;
	cursorOffsetX: number;
	cursorOffsetY: number;
};

type DragEvent =
	| {
			type: "START_CLIP_DRAG";
			clipId: string;
			trackId: string;
			startTime: number;
			offsetX: number;
			offsetY: number;
	  }
	| {
			type: "MOVE";
			previewTrackId: string;
			previewStartTime: number;
	  }
	| { type: "DROP" }
	| { type: "CANCEL" };

export const dragMachine = setup({
	types: {
		context: {} as DragContext,
		events: {} as DragEvent,
	},
}).createMachine({
	id: "drag",
	initial: "idle",
	context: {
		clipId: null,
		originTrackId: null,
		originStartTime: 0,
		previewTrackId: null,
		previewStartTime: 0,
		cursorOffsetX: 0,
		cursorOffsetY: 0,
	},
	states: {
		idle: {
			on: {
				START_CLIP_DRAG: {
					target: "dragging",
					actions: assign({
						clipId: ({ event }) => event.clipId,
						originTrackId: ({ event }) => event.trackId,
						originStartTime: ({ event }) => event.startTime,
						previewTrackId: ({ event }) => event.trackId,
						previewStartTime: ({ event }) => event.startTime,
						cursorOffsetX: ({ event }) => event.offsetX,
						cursorOffsetY: ({ event }) => event.offsetY,
					}),
				},
			},
		},
		dragging: {
			on: {
				MOVE: {
					actions: assign({
						previewTrackId: ({ event }) => event.previewTrackId,
						previewStartTime: ({ event }) => event.previewStartTime,
					}),
				},
				DROP: {
					target: "dropping",
				},
				CANCEL: {
					target: "idle",
					actions: assign({
						clipId: null,
						originTrackId: null,
						originStartTime: 0,
						previewTrackId: null,
						previewStartTime: 0,
						cursorOffsetX: 0,
						cursorOffsetY: 0,
					}),
				},
			},
		},
		dropping: {
			always: {
				target: "idle",
				actions: assign({
					clipId: null,
					originTrackId: null,
					originStartTime: 0,
					previewTrackId: null,
					previewStartTime: 0,
					cursorOffsetX: 0,
					cursorOffsetY: 0,
				}),
			},
		},
	},
});
