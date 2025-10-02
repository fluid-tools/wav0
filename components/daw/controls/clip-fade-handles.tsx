"use client";

import { memo, useCallback, useRef, useState } from "react";
import type { Clip } from "@/lib/state/daw-store";
import { cn } from "@/lib/utils";

type ClipFadeHandlesProps = {
	clip: Clip;
	clipWidth: number;
	pixelsPerMs: number;
	isSelected: boolean;
	onFadeChange: (clipId: string, fade: "fadeIn" | "fadeOut", value: number) => void;
};

export const ClipFadeHandles = memo(function ClipFadeHandles({
	clip,
	clipWidth: _clipWidth,
	pixelsPerMs,
	isSelected,
	onFadeChange,
}: ClipFadeHandlesProps) {
	const [draggingFade, setDraggingFade] = useState<"fadeIn" | "fadeOut" | null>(null);
	const dragStartXRef = useRef(0);
	const dragStartValueRef = useRef(0);

	const fadeInPx = (clip.fadeIn ?? 0) * pixelsPerMs;
	const fadeOutPx = (clip.fadeOut ?? 0) * pixelsPerMs;
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
		},
		[clip],
	);

	const handleFadePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!draggingFade) return;
			e.stopPropagation();

			const deltaX = e.clientX - dragStartXRef.current;
			const deltaMs = deltaX / pixelsPerMs;

			let newFadeMs: number;
			if (draggingFade === "fadeIn") {
				newFadeMs = Math.max(0, Math.min(dragStartValueRef.current + deltaMs, maxFadeMs));
			} else {
				newFadeMs = Math.max(0, Math.min(dragStartValueRef.current - deltaMs, maxFadeMs));
			}

			onFadeChange(clip.id, draggingFade, Math.round(newFadeMs));
		},
		[draggingFade, clip.id, pixelsPerMs, maxFadeMs, onFadeChange],
	);

	const handleFadePointerUp = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			setDraggingFade(null);
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		},
		[],
	);

	if (!isSelected) return null;

	return (
		<>
			{/* Fade In Overlay & Handle */}
			{fadeInPx > 0 && (
				<div
					className="absolute left-0 top-0 bottom-0 pointer-events-none z-10"
					style={{ width: fadeInPx }}
				>
					{/* Gradient overlay */}
					<div
						className="absolute inset-0 opacity-40"
						style={{
							background: "linear-gradient(to right, rgba(0,0,0,0.6), transparent)",
						}}
					/>
					
					{/* Fade curve visual - properly scaled */}
					<svg
						className="absolute inset-0 w-full h-full"
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						<title>Fade in curve visualization</title>
						<path
							d="M 0,100 Q 30,60 100,0"
							fill="none"
							stroke="rgba(255,255,255,0.5)"
							strokeWidth="1.5"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>

					{/* Draggable handle at fade end */}
					<button
						type="button"
						className={cn(
							"absolute top-0 bottom-0 w-1 cursor-ew-resize pointer-events-auto",
							"bg-primary hover:bg-primary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
							draggingFade === "fadeIn" && "bg-primary-foreground",
						)}
						style={{
							right: 0,
							opacity: draggingFade === "fadeIn" ? 1 : 0.7,
						}}
						onPointerDown={(e) => handleFadePointerDown("fadeIn", e)}
						onPointerMove={handleFadePointerMove}
						onPointerUp={handleFadePointerUp}
						aria-label={`Adjust fade in duration: ${clip.fadeIn ?? 0}ms`}
						title={`Fade in: ${clip.fadeIn ?? 0}ms`}
					>
						{/* Handle grip visual */}
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
							<div className="w-0.5 h-full bg-primary-foreground/50" />
						</div>
					</button>
				</div>
			)}

			{/* Fade Out Overlay & Handle */}
			{fadeOutPx > 0 && (
				<div
					className="absolute right-0 top-0 bottom-0 pointer-events-none z-10"
					style={{ width: fadeOutPx }}
				>
					{/* Gradient overlay */}
					<div
						className="absolute inset-0 opacity-40"
						style={{
							background: "linear-gradient(to left, rgba(0,0,0,0.6), transparent)",
						}}
					/>
					
					{/* Fade curve visual - properly scaled */}
					<svg
						className="absolute inset-0 w-full h-full"
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						<title>Fade out curve visualization</title>
						<path
							d="M 0,0 Q 70,40 100,100"
							fill="none"
							stroke="rgba(255,255,255,0.5)"
							strokeWidth="1.5"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>

					{/* Draggable handle at fade start */}
					<button
						type="button"
						className={cn(
							"absolute top-0 bottom-0 w-1 cursor-ew-resize pointer-events-auto",
							"bg-primary hover:bg-primary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
							draggingFade === "fadeOut" && "bg-primary-foreground",
						)}
						style={{
							left: 0,
							opacity: draggingFade === "fadeOut" ? 1 : 0.7,
						}}
						onPointerDown={(e) => handleFadePointerDown("fadeOut", e)}
						onPointerMove={handleFadePointerMove}
						onPointerUp={handleFadePointerUp}
						aria-label={`Adjust fade out duration: ${clip.fadeOut ?? 0}ms`}
						title={`Fade out: ${clip.fadeOut ?? 0}ms`}
					>
						{/* Handle grip visual */}
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
							<div className="w-0.5 h-full bg-primary-foreground/50" />
						</div>
					</button>
				</div>
			)}
		</>
	);
});
