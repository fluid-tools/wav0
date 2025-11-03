"use client";
import { time } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { useMemo } from "react";
import {
	cachedTimeGridAtom,
	horizontalScrollAtom,
	timelinePxPerMsAtom,
} from "@/lib/daw-sdk";

type Props = {
	width: number;
	height: number;
};

export function TimelineGridHeader({ width, height }: Props) {
	const [timeGrid] = useAtom(cachedTimeGridAtom);
	const [pxPerMs] = useAtom(timelinePxPerMsAtom);
	const [scrollLeft] = useAtom(horizontalScrollAtom);

	// Memoize SVG elements for performance
	const svgElements = useMemo(() => {
		if (!timeGrid.majors.length) return null;

		const elements: React.ReactElement[] = [];
		let lastLabelX = -1e9;
		const minLabelSpacing = 28; // px

		for (const marker of timeGrid.majors) {
			// Use unified timeToPixel function - same calculation as playhead and grid lines
			const x = time.timeToPixel(marker.ms, pxPerMs, scrollLeft);

			// Only render labels that are visible and have enough spacing
			if (x - lastLabelX >= minLabelSpacing && x >= 0 && x <= width) {
				elements.push(
					<text
						key={`label-${marker.ms}`}
						x={x + 4}
						y={12}
						fontSize="10"
						fontFamily="monospace"
						fill="var(--timeline-grid-label)"
						className="select-none"
					>
						{marker.label}
					</text>,
				);
				lastLabelX = x;
			}
		}

		return elements;
	}, [timeGrid.majors, pxPerMs, scrollLeft, width]);

	return (
		<svg
			className="absolute inset-0 pointer-events-none"
			width={width}
			height={height}
			style={{ width, height }}
			aria-label="Timeline grid labels"
		>
			<title>Timeline Grid Labels</title>
			{svgElements}
		</svg>
	);
}
