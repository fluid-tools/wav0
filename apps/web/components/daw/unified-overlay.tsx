"use client";

import { useAtom } from "jotai";
import { memo } from "react";
import { projectEndViewportPxAtom } from "@/lib/daw-sdk";

export const UnifiedOverlay = memo(function UnifiedOverlay() {
	const [projectEndX] = useAtom(projectEndViewportPxAtom);

	return (
		<div className="pointer-events-none absolute inset-0">
			<div
				className="pointer-events-none absolute top-0 bottom-0 w-px bg-yellow-500/70"
				style={{ left: projectEndX }}
			/>
		</div>
	);
});
