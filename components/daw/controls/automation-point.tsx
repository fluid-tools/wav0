"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

export type AutomationPointProps = {
	x: number;
	y: number;
	isSelected?: boolean;
	isDragging?: boolean;
	onPointerDown?: (e: React.PointerEvent) => void;
	onContextMenu?: (e: React.MouseEvent) => void;
	className?: string;
};

/**
 * Reusable automation point component for visual curve editing
 * Renders a draggable point with selection and hover states
 */
export const AutomationPoint = memo(function AutomationPoint({
	x,
	y,
	isSelected = false,
	isDragging = false,
	onPointerDown,
	onContextMenu,
	className,
}: AutomationPointProps) {
	// Guard against invalid coordinates
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		return null;
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: SVG <g> elements cannot be replaced with semantic HTML elements
		<g
			transform={`translate(${x}, ${y})`}
			className={cn("cursor-move transition-transform", className)}
			onPointerDown={onPointerDown}
			onContextMenu={onContextMenu}
			role="button"
			aria-label="Automation point"
			style={{
				transformOrigin: "center",
			}}
		>
			{/* Outer glow for selected state */}
			{isSelected && (
				<circle
					r={8}
					fill="currentColor"
					opacity={0.2}
					className="pointer-events-none"
				/>
			)}

			{/* Main point */}
			<circle
				r={isDragging ? 5 : 4}
				fill={isSelected ? "hsl(var(--primary))" : "currentColor"}
				stroke={isSelected ? "hsl(var(--background))" : "transparent"}
				strokeWidth={isSelected ? 2 : 0}
				className="transition-all"
				opacity={isDragging ? 0.8 : 1}
			/>

			{/* Hit area (invisible, larger for easier interaction) */}
			<circle r={12} fill="transparent" className="cursor-pointer" />
		</g>
	);
});
