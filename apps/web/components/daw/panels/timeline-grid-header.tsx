"use client";
import { useAtom } from "jotai";
import { useMemo } from "react";
import { cachedGridSubdivisionsAtom } from "@/lib/daw-sdk/state/view";

type Props = {
	width: number;
	height: number;
	pxPerMs: number;
	scrollLeft: number;
};

export function TimelineGridHeader({
	width,
	height,
	pxPerMs,
	scrollLeft,
}: Props) {
	const [grid] = useAtom(cachedGridSubdivisionsAtom);

	// Memoize SVG elements for performance
	const svgElements = useMemo(() => {
		if (!grid.measures.length) return null;

		const elements: React.ReactElement[] = [];
		let lastLabelX = -1e9;
		const minLabelSpacing = 28; // px

		for (const measure of grid.measures) {
			const x = measure.ms * pxPerMs - scrollLeft;

			// Only render labels that are visible and have enough spacing
			if (x - lastLabelX >= minLabelSpacing && x >= 0 && x <= width) {
				elements.push(
					<text
						key={`label-${measure.bar}`}
						x={x + 4}
						y={12}
						fontSize="10"
						fontFamily="monospace"
						fill="var(--timeline-grid-label)"
						className="select-none"
					>
						{measure.bar}
					</text>,
				);
				lastLabelX = x;
			}
		}

		return elements;
	}, [grid.measures, pxPerMs, scrollLeft, width]);

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
