"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Clip } from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";
import { cn } from "@/lib/utils";

type ClipFadeHandlesProps = {
	clip: Clip;
	clipWidth: number;
	pixelsPerMs: number;
	isSelected: boolean;
	onFadeChange: (
		clipId: string,
		fade: "fadeIn" | "fadeOut",
		value: number,
	) => void;
};

// Constants for fade behavior
const VISUAL_MIN_FADE_MS = 500; // 0.5s minimum enforced via clip UI
const SNAP_THRESHOLD_MS = 120; // Snap to zero when within ~0.12s
const DEFAULT_FADE_MS = VISUAL_MIN_FADE_MS; // Default fade on double-click

export const ClipFadeHandles = memo(function ClipFadeHandles({
	clip,
	clipWidth: _clipWidth,
	pixelsPerMs,
	isSelected,
	onFadeChange,
}: ClipFadeHandlesProps) {
	const [draggingFade, setDraggingFade] = useState<"fadeIn" | "fadeOut" | null>(
		null,
	);
	const dragStartXRef = useRef(0);
	const dragStartValueRef = useRef(0);

	const clipDurationMs = clip.trimEnd - clip.trimStart;
	const maxFadeMs = clipDurationMs / 2; // Max 50% of clip

	const handleFadePointerDown = useCallback(
		(fade: "fadeIn" | "fadeOut", e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();
			setDraggingFade(fade);
			dragStartXRef.current = e.clientX;
			dragStartValueRef.current = clip[fade] ?? 0;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

			// Lock grid panning
			window.dispatchEvent(
				new CustomEvent("wav0:grid-pan-lock", { detail: true }),
			);
		},
		[clip],
	);

	const handleFadePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!draggingFade) return;
			e.stopPropagation();

			const deltaX = e.clientX - dragStartXRef.current;

			// Fine-tuning: 10x slower when Shift is held
			const multiplier = e.shiftKey ? 0.1 : 1;
			const deltaMs = (deltaX / pixelsPerMs) * multiplier;

			let newFadeMs: number;
			if (draggingFade === "fadeIn") {
				newFadeMs = dragStartValueRef.current + deltaMs;
			} else {
				newFadeMs = dragStartValueRef.current - deltaMs;
			}

			newFadeMs = Math.max(0, Math.min(newFadeMs, maxFadeMs));

			if (newFadeMs > 0 && newFadeMs < VISUAL_MIN_FADE_MS) {
				newFadeMs = newFadeMs <= SNAP_THRESHOLD_MS ? 0 : VISUAL_MIN_FADE_MS;
			}

			onFadeChange(clip.id, draggingFade, Math.round(newFadeMs));
		},
		[draggingFade, clip.id, pixelsPerMs, maxFadeMs, onFadeChange],
	);

	const handleFadePointerUp = useCallback((e: React.PointerEvent) => {
		e.stopPropagation();
		setDraggingFade(null);
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

		// Unlock grid panning
		window.dispatchEvent(
			new CustomEvent("wav0:grid-pan-lock", { detail: false }),
		);
	}, []);

	// Double-click to reset/remove fade
	const handleFadeDoubleClick = useCallback(
		(fade: "fadeIn" | "fadeOut", e: React.MouseEvent) => {
			e.stopPropagation();
			const currentValue = clip[fade] ?? 0;

			// If has fade, remove it; if no fade, add default
			const newValue =
				currentValue > 0 ? 0 : Math.min(DEFAULT_FADE_MS, maxFadeMs);
			onFadeChange(clip.id, fade, newValue);
		},
		[clip, maxFadeMs, onFadeChange],
	);

	// Escape key to cancel drag
	useEffect(() => {
		if (!draggingFade) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// Revert to original value
				const originalValue = dragStartValueRef.current;
				onFadeChange(clip.id, draggingFade, originalValue);
				setDraggingFade(null);

				// Unlock grid
				window.dispatchEvent(
					new CustomEvent("wav0:grid-pan-lock", { detail: false }),
				);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [draggingFade, clip.id, onFadeChange]);

	// Lock scroll while dragging fade handles
	useEffect(() => {
		if (!draggingFade) return;

		// Prevent all scroll/touch events during drag
		const preventScroll = (e: Event) => {
			e.preventDefault();
			e.stopPropagation();
		};

		document.addEventListener("wheel", preventScroll, { passive: false });
		document.addEventListener("touchmove", preventScroll, { passive: false });
		document.body.style.overflow = "hidden";
		document.body.style.userSelect = "none";

		return () => {
			document.removeEventListener("wheel", preventScroll);
			document.removeEventListener("touchmove", preventScroll);
			document.body.style.overflow = "";
			document.body.style.userSelect = "";
		};
	}, [draggingFade]);

	if (!isSelected) return null;

	// Render fade handle (always visible, even at 0)
	const renderFadeHandle = (fade: "fadeIn" | "fadeOut") => {
		const fadeValue = clip[fade] ?? 0;
		const effectiveFadeMs =
			fadeValue === 0 ? 0 : Math.max(fadeValue, VISUAL_MIN_FADE_MS);
		const fadePx = effectiveFadeMs * pixelsPerMs;
		const hasNoFade = fadeValue === 0;
		const isDrawerOnly = !hasNoFade && fadeValue < VISUAL_MIN_FADE_MS;
		const isDragging = draggingFade === fade;
		const isLeft = fade === "fadeIn";

		return (
			<>
				{/* Overlay & Curve (only if fade > 0) */}
				{fadeValue > 0 && (
					<div
						className="absolute top-0 bottom-0 pointer-events-none z-10"
						style={{
							[isLeft ? "left" : "right"]: 0,
							width: fadePx,
						}}
					>
						{/* Gradient overlay with color tint */}
						<div
							className="absolute inset-0 opacity-40"
							style={{
								background: isLeft
									? "linear-gradient(to right, rgba(34, 197, 94, 0.3), transparent)" // green
									: "linear-gradient(to left, rgba(239, 68, 68, 0.3), transparent)", // red
							}}
						/>

						{/* Fade curve visual */}
						<svg
							className="absolute inset-0 w-full h-full"
							viewBox="0 0 100 100"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							<title>{`${fade === "fadeIn" ? "Fade in" : "Fade out"} curve visualization`}</title>
							<path
								d={isLeft ? "M 0,100 Q 30,60 100,0" : "M 0,0 Q 70,40 100,100"}
								fill="none"
								stroke="rgba(255,255,255,0.6)"
								strokeWidth="2"
								vectorEffect="non-scaling-stroke"
							/>
						</svg>
					</div>
				)}

				{/* Draggable handle - always visible */}
				<button
					type="button"
					className={cn(
						"absolute top-0 bottom-0 cursor-ew-resize pointer-events-auto",
						"bg-primary transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
						"hover:shadow-[0_0_8px_rgba(var(--primary),0.5)]",
						hasNoFade &&
							"border-2 border-dashed border-primary bg-transparent opacity-30",
						isDrawerOnly &&
							'after:absolute after:-top-7 after:left-1/2 after:-translate-x-1/2 after:rounded after:bg-amber-500/90 after:px-2 after:py-0.5 after:text-[10px] after:font-medium after:text-black after:content-["Drawer-only"]',
						isDragging &&
							"scale-x-150 opacity-100 shadow-[0_0_12px_rgba(var(--primary),0.8)]",
						!isDragging && !hasNoFade && "opacity-70 hover:opacity-90",
					)}
					style={{
						[isLeft ? "left" : "right"]: hasNoFade ? 0 : fadePx,
						width: hasNoFade ? "8px" : isDragging ? "4px" : "3px",
						transform: hasNoFade
							? `translateX(${isLeft ? "-4px" : "4px"})`
							: undefined,
					}}
					onPointerDown={(e) => handleFadePointerDown(fade, e)}
					onPointerMove={handleFadePointerMove}
					onPointerUp={handleFadePointerUp}
					onDoubleClick={(e) => handleFadeDoubleClick(fade, e)}
					aria-label={`Adjust ${fade === "fadeIn" ? "fade in" : "fade out"} duration: ${fadeValue}ms`}
					title={`${fade === "fadeIn" ? "Fade in" : "Fade out"}: ${formatDuration(fadeValue)}\nDouble-click to ${fadeValue > 0 ? "remove" : "add"}\nShift+drag for precision`}
				>
					{/* Handle grip visual */}
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<div className="w-0.5 h-full bg-primary-foreground/60" />
					</div>

					{/* Tooltip during drag */}
					{isDragging && (
						<div
							className="absolute -top-10 left-1/2 -translate-x-1/2 
						                bg-popover text-popover-foreground px-3 py-1.5 
						                rounded-md text-xs font-medium whitespace-nowrap shadow-lg 
						                border border-border pointer-events-none z-50"
						>
							{formatDuration(fadeValue === 0 ? VISUAL_MIN_FADE_MS : fadeValue)}
						</div>
					)}
				</button>
			</>
		);
	};

	return (
		<>
			{/* Fade In */}
			{renderFadeHandle("fadeIn")}

			{/* Fade Out */}
			{renderFadeHandle("fadeOut")}
		</>
	);
});
