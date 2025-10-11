"use client";

import { evaluateSegmentCurve } from "@/lib/daw-sdk";

type SegmentCurvePreviewProps = {
	curve: number; // -99 to +99
	width?: number;
	height?: number;
	className?: string;
	strokeWidth?: number;
};

/**
 * Visual preview of automation/fade curve using -99 to +99 parameter
 * -99 = Exponential (fast start, slow end)
 * 0 = Linear
 * +99 = Logarithmic (slow start, fast end)
 */
export function SegmentCurvePreview({
	curve,
	width = 160,
	height = 60,
	className = "",
	strokeWidth = 2,
}: SegmentCurvePreviewProps) {
	const samples = 50;
	const points: string[] = [];

	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		const value = evaluateSegmentCurve(0, 1, t, curve);
		const x = (t * 100).toFixed(2);
		const y = ((1 - value) * 100).toFixed(2);
		points.push(`${x},${y}`);
	}

	return (
		<svg
			viewBox="0 0 100 100"
			width={width}
			height={height}
			className={`${className}`}
			style={{ display: "block" }}
		>
			{/* Background grid */}
			<line
				x1="0"
				y1="50"
				x2="100"
				y2="50"
				stroke="currentColor"
				strokeWidth="0.5"
				strokeDasharray="2,2"
				opacity="0.2"
			/>
			<line
				x1="50"
				y1="0"
				x2="50"
				y2="100"
				stroke="currentColor"
				strokeWidth="0.5"
				strokeDasharray="2,2"
				opacity="0.2"
			/>

			{/* Curve path */}
			<polyline
				points={points.join(" ")}
				fill="none"
				stroke="currentColor"
				strokeWidth={strokeWidth}
				vectorEffect="non-scaling-stroke"
			/>

			{/* Start and end points */}
			<circle cx="0" cy="100" r="2" fill="currentColor" opacity="0.6" />
			<circle cx="100" cy="0" r="2" fill="currentColor" opacity="0.6" />
		</svg>
	);
}
