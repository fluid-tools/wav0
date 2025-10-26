"use client";
import { useAtom } from "jotai";
import { useMemo } from "react";
import { coordinatesAtom } from "@/lib/daw-sdk/state/coordinates";
import { cachedGridSubdivisionsAtom } from "@/lib/daw-sdk/state/view";
import {
	alignHairline,
	msToViewportPx,
	type Scale,
} from "@/lib/daw-sdk/utils/scale";

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
	const [coords] = useAtom(coordinatesAtom);

	// Compute playhead position using unified scale conversions
	const scale: Scale = { pxPerMs, scrollLeft };
	const playheadVx = alignHairline(msToViewportPx(coords.playheadMs, scale));

	// Memoize SVG elements for performance
	const svgElements = useMemo(() => {
		if (!grid.measures.length) return null;

		const elements: React.ReactElement[] = [];
		let lastLabelX = -1e9;
		const minLabelSpacing = 28; // px

		const scale: Scale = { pxPerMs, scrollLeft };
		for (const measure of grid.measures) {
			const x = msToViewportPx(measure.ms, scale);

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
			{/* Playhead indicator line */}
			{playheadVx >= 0 && playheadVx <= width && (
				<line
					x1={playheadVx}
					y1={0}
					x2={playheadVx}
					y2={height}
					stroke="rgb(239, 68, 68)"
					strokeWidth={1}
				/>
			)}
			{svgElements}
		</svg>
	);
}
