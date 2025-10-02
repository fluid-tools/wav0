"use client";

import { memo } from "react";
import type { CurveType } from "@/lib/audio/curve-functions";
import { evaluateCurve } from "@/lib/audio/curve-functions";
import { cn } from "@/lib/utils";

type CurvePreviewProps = {
	type: CurveType;
	shape?: number;
	width?: number;
	height?: number;
	className?: string;
	strokeWidth?: number;
};

/**
 * Visual preview of audio curve shape
 * Renders an SVG path showing the curve profile
 */
export const CurvePreview = memo(function CurvePreview({
	type,
	shape = 0.5,
	width = 80,
	height = 40,
	className,
	strokeWidth = 2,
}: CurvePreviewProps) {
	// Generate curve path
	const numPoints = 50;
	const points: { x: number; y: number }[] = [];

	for (let i = 0; i < numPoints; i++) {
		const t = i / (numPoints - 1);
		const value = evaluateCurve(type, t, shape);
		points.push({
			x: t * width,
			y: height - value * height, // Flip Y (SVG origin is top-left)
		});
	}

	const pathData = points
		.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
		.join(" ");

	return (
		<svg
			width={width}
			height={height}
			className={cn("inline-block", className)}
			viewBox={`0 0 ${width} ${height}`}
			role="img"
			aria-label={`${type} curve preview`}
		>
			<title>{`${type} curve preview`}</title>
			{/* Grid lines for reference */}
			<line
				x1={0}
				y1={height / 2}
				x2={width}
				y2={height / 2}
				stroke="currentColor"
				strokeOpacity={0.1}
				strokeWidth={1}
			/>
			<line
				x1={width / 2}
				y1={0}
				x2={width / 2}
				y2={height}
				stroke="currentColor"
				strokeOpacity={0.1}
				strokeWidth={1}
			/>

			{/* Curve path */}
			<path
				d={pathData}
				fill="none"
				stroke="currentColor"
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>

			{/* Start and end dots */}
			<circle
				cx={points[0].x}
				cy={points[0].y}
				r={2.5}
				fill="currentColor"
				opacity={0.6}
			/>
			<circle
				cx={points[points.length - 1].x}
				cy={points[points.length - 1].y}
				r={2.5}
				fill="currentColor"
				opacity={0.6}
			/>
		</svg>
	);
});
