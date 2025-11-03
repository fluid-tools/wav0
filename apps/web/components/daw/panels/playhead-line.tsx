"use client";

import { useAtom } from "jotai";
import { memo, useRef, useLayoutEffect } from "react";
import { horizontalScrollAtom, playbackAtom, timelinePxPerMsAtom } from "@/lib/daw-sdk";
import { time } from "@wav0/daw-sdk";

export const PlayheadLine = memo(function PlayheadLine() {
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [playback] = useAtom(playbackAtom);
	const [horizontalScroll] = useAtom(horizontalScrollAtom);
	const lineRef = useRef<HTMLDivElement>(null);

	// Use layoutEffect to update position synchronously before browser paint
	// This ensures the playhead position is always in sync with grid lines and other playhead
	useLayoutEffect(() => {
		if (!lineRef.current) return;

		// Calculate position using unified timeToPixel function
		const playheadX = Math.round(
			time.timeToPixel(playback.currentTime, pxPerMs, horizontalScroll)
		);

		// Apply transform directly to DOM (bypasses React render for immediate sync)
		lineRef.current.style.transform = `translateX(${playheadX}px)`;
	}, [playback.currentTime, pxPerMs, horizontalScroll]);

	return (
		<div
			ref={lineRef}
			className="pointer-events-none absolute top-0 bottom-0 left-0 w-px bg-red-500 z-15"
			style={{
				transform: "translateX(0px)", // Initial position
				willChange: "transform",
			}}
		/>
	);
});
