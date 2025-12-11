"use client";

import { playbackAtom } from "@wav0/daw-react";
import type { Track } from "@wav0/daw-sdk";
import { volume } from "@wav0/daw-sdk";
import { useAtomValue } from "jotai";
import { selectAtom } from "jotai/utils";
import { memo } from "react";

const playbackCurrentTimeAtom = selectAtom(
	playbackAtom,
	(state) => state.currentTime,
	(a, b) => a === b,
);

type LiveAutomationBadgeProps = {
	envelope?: Track["volumeEnvelope"];
	baseVolume: number;
	isPlaying: boolean;
};

export const LiveAutomationBadge = memo(function LiveAutomationBadge({
	envelope,
	baseVolume,
	isPlaying,
}: LiveAutomationBadgeProps) {
	const currentTime = useAtomValue(playbackCurrentTimeAtom);
	const quantizedTime = Math.round(currentTime / 16) * 16;

	const { currentDb, isAutomated } = (() => {
		const hasAutomation = Boolean(envelope?.enabled) && Boolean(envelope?.points?.length);
		if (!hasAutomation) return { currentDb: null, isAutomated: false };

		const multiplier = getEnvelopeMultiplierAtTime(
			envelope?.points || [],
			envelope?.segments || [],
			quantizedTime,
		);
		const currentDbValue = volume.getEffectiveDb(baseVolume ?? 75, multiplier);
		return { currentDb: currentDbValue, isAutomated: true };
	})();

	// Only show during playback when automation is active
	if (!isPlaying || !isAutomated || currentDb === null) {
		return null;
	}

	return (
		<div
			className="flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 ring-1 ring-amber-500/30"
			title="Current automated gain"
		>
			<span className="text-[9px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
				Live
			</span>
			<span className="font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300">
				{volume.formatDb(currentDb, 1)}
			</span>
		</div>
	);
});

function getEnvelopeMultiplierAtTime(
	points: Array<{ time: number; value: number; id: string }>,
	segments: Array<{ fromPointId: string; toPointId: string; curve?: number }>,
	timeMs: number,
): number {
	if (points.length === 0) return 1.0;

	const sorted = [...points].sort((a, b) => a.time - b.time);

	if (timeMs <= sorted[0].time) {
		return sorted[0].value;
	}

	if (timeMs >= sorted[sorted.length - 1].time) {
		return sorted[sorted.length - 1].value;
	}

	for (let i = 0; i < sorted.length - 1; i++) {
		const p1 = sorted[i];
		const p2 = sorted[i + 1];

		if (timeMs >= p1.time && timeMs <= p2.time) {
			const segment = segments.find(
				(seg) => seg.fromPointId === p1.id && seg.toPointId === p2.id,
			);
			const curve = segment?.curve ?? 0;
			const progress = (timeMs - p1.time) / (p2.time - p1.time);
			return interpolateValue(p1.value, p2.value, progress, curve);
		}
	}

	return 1.0;
}

function interpolateValue(
	start: number,
	end: number,
	progress: number,
	curve: number,
): number {
	if (curve === 0) {
		return start + (end - start) * progress;
	}

	let curvedProgress: number;
	if (curve < 0) {
		const power = 1 + (Math.abs(curve) / 99) * 3;
		curvedProgress = progress ** power;
	} else {
		const power = 1 + (curve / 99) * 3;
		curvedProgress = 1 - (1 - progress) ** power;
	}

	return start + (end - start) * curvedProgress;
}
