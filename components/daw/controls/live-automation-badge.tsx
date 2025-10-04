"use client";

import { useAtom } from "jotai";
import { formatDb } from "@/lib/audio/volume";
import { useLiveAutomationGain } from "@/lib/hooks/use-live-automation-gain";
import { playbackAtom } from "@/lib/state/daw-store";

type LiveAutomationBadgeProps = {
	trackId: string;
};

export function LiveAutomationBadge({ trackId }: LiveAutomationBadgeProps) {
	const [playback] = useAtom(playbackAtom);
	const { currentDb, isAutomated } = useLiveAutomationGain(trackId);

	// Only show during playback when automation is active
	if (!playback.isPlaying || !isAutomated || currentDb === null) {
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
				{formatDb(currentDb, 1)}
			</span>
		</div>
	);
}
