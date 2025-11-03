"use client";

import { useAtom } from "jotai";
import { memo } from "react";
import { horizontalScrollAtom, playbackAtom, timelinePxPerMsAtom } from "@/lib/daw-sdk";
import { time } from "@wav0/daw-sdk";

export const PlayheadLine = memo(function PlayheadLine() {
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [playback] = useAtom(playbackAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	
	// Calculate playhead position using same logic as UnifiedOverlay
	// Both scroll containers are synchronized, so same calculation works
	const playheadX = Math.round(
		time.timeToPixel(playback.currentTime, pxPerMs, horizontalScroll)
	);

	return (
		<div
			className="pointer-events-none absolute top-0 bottom-0 w-px bg-red-500 z-15"
			style={{
				left: `${playheadX}px`,
			}}
		/>
	);
});
