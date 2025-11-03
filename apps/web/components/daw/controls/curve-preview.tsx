"use client";

import { type CurveType, curves } from "@wav0/daw-sdk";
import { memo } from "react";
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

	// Ensure all numeric params are valid
	const safeShape = Number.isFinite(shape) ? shape : 0.5;
	const safeWidth = Number.isFinite(width) && width > 0 ? width : 80;
	const safeHeight = Number.isFinite(height) && height > 0 ? height : 40;

	for (let i = 0; i < numPoints; i++) {
		const t = i / (numPoints - 1);
		let value: number;

		// Map CurveType to appropriate curve evaluation
		switch (type) {
			case "linear": {
				// Linear: always use 0 curve value
				value = curves.evaluateSegmentCurve(0, 1, t, 0);
				break;
			}
			case "easeIn": {
				// EaseIn: exponential (fast start, slow end) = negative curve
				// Use shape (0-1) to control intensity: map to -99 to 0
				const curveValue = -(safeShape * 99);
				value = curves.evaluateSegmentCurve(0, 1, t, curveValue);
				break;
			}
			case "easeOut": {
				// EaseOut: logarithmic (slow start, fast end) = positive curve
				// Use shape (0-1) to control intensity: map to 0 to +99
				const curveValue = safeShape * 99;
				value = curves.evaluateSegmentCurve(0, 1, t, curveValue);
				break;
			}
			case "sCurve": {
				// S-curve: slow start, fast middle, slow end
				// Use smoothstep function for S-curve: t * t * (3 - 2 * t)
				// Apply shape to modulate the S-curve intensity
				const smoothstep = t * t * (3 - 2 * t);
				// Blend between linear and smoothstep based on shape
				const intensity = safeShape;
				value = t * (1 - intensity) + smoothstep * intensity;
				break;
			}
			default: {
				// Fallback to linear
				value = curves.evaluateSegmentCurve(0, 1, t, 0);
				break;
			}
		}

		// Guard against NaN/Infinity
		if (!Number.isFinite(value)) {
			console.warn(
				`CurvePreview: Invalid value at t=${t}, type=${type}, shape=${safeShape}`,
			);
			continue;
		}

		points.push({
			x: t * safeWidth,
			y: safeHeight - value * safeHeight, // Flip Y (SVG origin is top-left)
		});
	}

	// Bail if no valid points
	if (points.length < 2) {
		return (
			<svg
				width={safeWidth}
				height={safeHeight}
				className={cn("inline-block", className)}
				role="img"
				aria-label="Invalid curve data"
			>
				<title>Invalid curve data</title>
				<text
					x={safeWidth / 2}
					y={safeHeight / 2}
					textAnchor="middle"
					fontSize="10"
					fill="currentColor"
					opacity={0.5}
				>
					Invalid curve
				</text>
			</svg>
		);
	}

	const pathData = points
		.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
		.join(" ");

	return (
		<svg
			width={safeWidth}
			height={safeHeight}
			className={cn("inline-block", className)}
			viewBox={`0 0 ${safeWidth} ${safeHeight}`}
			role="img"
			aria-label={`${type} curve preview`}
		>
			<title>{`${type} curve preview`}</title>
			{/* Grid lines for reference */}
			<line
				x1={0}
				y1={safeHeight / 2}
				x2={safeWidth}
				y2={safeHeight / 2}
				stroke="currentColor"
				strokeOpacity={0.1}
				strokeWidth={1}
			/>
			<line
				x1={safeWidth / 2}
				y1={0}
				x2={safeWidth / 2}
				y2={safeHeight}
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
