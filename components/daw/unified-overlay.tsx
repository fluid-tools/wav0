"use client";

import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import {
	playheadViewportPxAtom,
	totalDurationAtom,
	projectEndPositionAtom,
} from "@/lib/state/daw-store";

export function UnifiedOverlay() {
	const [playheadX] = useAtom(playheadViewportPxAtom);
	const [projectEndX] = useAtom(projectEndPositionAtom);
	const containerRef = useRef<HTMLDivElement>(null);

	// Re-render on resize to ensure full-height
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => {});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	return (
		<div
			ref={containerRef}
			className="pointer-events-none absolute inset-0 z-50"
		>
			{/* Red playhead */}
			<div
				className="absolute top-0 bottom-0 w-0.5 bg-red-500"
				style={{ left: playheadX }}
			/>
			{/* Yellow project end */}
			<div
				className="absolute top-0 bottom-0 w-px bg-yellow-500/70"
				style={{ left: projectEndX }}
			/>
		</div>
	);
}
