/**
 * Hook for managing track content interactions (drag, resize, loop)
 * Provides a clean API over the interaction state machine
 */

"use client";

import { useAtom, useAtomValue } from "jotai";
import type { InteractionState } from "../atoms/machines/interaction-machine";
import {
	clipDragPreviewAtom,
	interactionMachineAtom,
	interactionStateAtom,
	isInteractionActiveAtom,
	loopDragInteractionAtom,
	resizeInteractionAtom,
} from "../atoms/ui";

export type UseTrackInteractionsReturn = {
	// State
	state: InteractionState;
	isActive: boolean;

	// Derived interaction data
	clipDrag: ReturnType<typeof useAtomValue<typeof clipDragPreviewAtom>>;
	resize: ReturnType<typeof useAtomValue<typeof resizeInteractionAtom>>;
	loopDrag: ReturnType<typeof useAtomValue<typeof loopDragInteractionAtom>>;

	// Actions
	startClipDrag: (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startY: number;
		startTime: number;
		originalTrackIndex: number;
		offsetX: number;
		offsetY: number;
		startScrollLeft: number;
	}) => void;

	startResize: (params: {
		trackId: string;
		clipId: string;
		resizeType: "start" | "end";
		startX: number;
		startTrimStart: number;
		startTrimEnd: number;
		startClipStartTime: number;
	}) => void;

	startLoopDrag: (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startLoopEnd: number | undefined;
	}) => void;

	move: (params: {
		previewTrackId?: string;
		previewStartTime?: number;
		x?: number;
		y?: number;
	}) => void;

	commit: () => void;
	cancel: () => void;
};

export function useTrackInteractions(): UseTrackInteractionsReturn {
	const [, send] = useAtom(interactionMachineAtom);
	const state = useAtomValue(interactionStateAtom);
	const isActive = useAtomValue(isInteractionActiveAtom);
	const clipDrag = useAtomValue(clipDragPreviewAtom);
	const resize = useAtomValue(resizeInteractionAtom);
	const loopDrag = useAtomValue(loopDragInteractionAtom);

	const startClipDrag = (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startY: number;
		startTime: number;
		originalTrackIndex: number;
		offsetX: number;
		offsetY: number;
		startScrollLeft: number;
	}) => {
		send({ type: "START_CLIP_DRAG", ...params });
	};

	const startResize = (params: {
		trackId: string;
		clipId: string;
		resizeType: "start" | "end";
		startX: number;
		startTrimStart: number;
		startTrimEnd: number;
		startClipStartTime: number;
	}) => {
		send({ type: "START_RESIZE", ...params });
	};

	const startLoopDrag = (params: {
		trackId: string;
		clipId: string;
		startX: number;
		startLoopEnd: number | undefined;
	}) => {
		send({ type: "START_LOOP_DRAG", ...params });
	};

	const move = (params: {
		previewTrackId?: string;
		previewStartTime?: number;
		x?: number;
		y?: number;
	}) => {
		send({ type: "MOVE", ...params });
	};

	const commit = () => {
		send({ type: "COMMIT" });
	};

	const cancel = () => {
		send({ type: "CANCEL" });
	};

	return {
		state,
		isActive,
		clipDrag,
		resize,
		loopDrag,
		startClipDrag,
		startResize,
		startLoopDrag,
		move,
		commit,
		cancel,
	};
}
