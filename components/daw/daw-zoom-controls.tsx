"use client";

import { useAtom } from "jotai";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	timelineAtom,
	zoomInAtom,
	zoomOutAtom,
} from "@/lib/state/daw-store";

export function DAWZoomControls() {
	const [timeline] = useAtom(timelineAtom);
	const [, zoomIn] = useAtom(zoomInAtom);
	const [, zoomOut] = useAtom(zoomOutAtom);

	return (
		<div className="flex items-center gap-1 bg-muted/10 rounded-md p-1">
			<Button
				variant="ghost"
				size="sm"
				onClick={zoomOut}
				disabled={timeline.zoom <= 0.25}
				className="h-7 w-7 p-0"
				aria-label="Zoom out"
			>
				<Minus className="w-3 h-3" />
			</Button>
			
			<span className="text-xs text-muted-foreground min-w-12 text-center font-mono">
				{Math.round(timeline.zoom * 100)}%
			</span>
			
			<Button
				variant="ghost"
				size="sm"
				onClick={zoomIn}
				disabled={timeline.zoom >= 4}
				className="h-7 w-7 p-0"
				aria-label="Zoom in"
			>
				<Plus className="w-3 h-3" />
			</Button>
		</div>
	);
}
