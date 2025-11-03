"use client";

import { useAtom } from "jotai";
import { memo } from "react";
import {
	projectEndViewportPxAtom,
} from "@/lib/daw-sdk";

/**
 * UnifiedOverlay - Now only renders project end marker
 *
 * Playhead rendering has been moved to UnifiedPlayhead component
 * which spans both timeline and track content areas.
 */
export const UnifiedOverlay = memo(function UnifiedOverlay() {
	const [projectEndX] = useAtom(projectEndViewportPxAtom);

	return (
		<div className="pointer-events-none absolute inset-0">
			{/* Project end marker */}
			<div
				className="pointer-events-none absolute top-0 bottom-0 w-px bg-yellow-500/70"
				style={{ left: projectEndX }}
			/>
		</div>
	);
});
