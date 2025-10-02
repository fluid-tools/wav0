"use client";

import { useCallback, useState } from "react";
import type { Clip } from "@/lib/state/daw-store";

type ClipFadeHandlesProps = {
	clip: Clip;
	clipWidth: number;
	pixelsPerMs: number;
	isSelected: boolean;
	onFadeChange: (clipId: string, fade: "fadeIn" | "fadeOut", value: number) => void;
};

export function ClipFadeHandles({
	clip,
	clipWidth: _clipWidth,
	pixelsPerMs,
	isSelected,
	onFadeChange,
}: ClipFadeHandlesProps) {
	const [draggingFade, setDraggingFade] = useState<
		"fadeIn" | "fadeOut" | null
	>(null);

	const fadeInPx = (clip.fadeIn ?? 0) * pixelsPerMs;
	const fadeOutPx = (clip.fadeOut ?? 0) * pixelsPerMs;

	const handleFadePointerDown = useCallback(
		(fade: "fadeIn" | "fadeOut", e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();
			setDraggingFade(fade);
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
		},
		[],
	);

	const handleFadePointerMove = useCallback(
		(fade: "fadeIn" | "fadeOut", e: React.PointerEvent) => {
			if (draggingFade !== fade) return;
			e.stopPropagation();

			const target = e.currentTarget as HTMLElement;
			const rect = target.getBoundingClientRect();
			const clipDurationMs = clip.trimEnd - clip.trimStart;
			const maxFadeMs = clipDurationMs / 2; // Max 50% of clip

			if (fade === "fadeIn") {
				const offsetX = e.clientX - rect.left;
				const newFadeMs = Math.max(0, Math.min(offsetX / pixelsPerMs, maxFadeMs));
				onFadeChange(clip.id, "fadeIn", Math.round(newFadeMs));
			} else {
				const offsetX = rect.right - e.clientX;
				const newFadeMs = Math.max(0, Math.min(offsetX / pixelsPerMs, maxFadeMs));
				onFadeChange(clip.id, "fadeOut", Math.round(newFadeMs));
			}
		},
		[draggingFade, clip.id, clip.trimEnd, clip.trimStart, pixelsPerMs, onFadeChange],
	);

	const handleFadePointerUp = useCallback((e: React.PointerEvent) => {
		e.stopPropagation();
		setDraggingFade(null);
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);
	}, []);

	if (!isSelected) return null;

	return (
		<>
			{/* Fade In Handle & Overlay */}
			{fadeInPx > 0 && (
				<div
					className="absolute left-0 top-0 bottom-0 pointer-events-none"
					style={{ width: fadeInPx }}
				>
					{/* Fade gradient overlay */}
					<div
						className="absolute inset-0"
						style={{
							background: "linear-gradient(to right, rgba(0,0,0,0.3), transparent)",
						}}
					/>
					{/* Fade curve visual */}
					<svg
						className="absolute inset-0 pointer-events-none"
						preserveAspectRatio="none"
						viewBox="0 0 100 100"
					>
						<path
							d="M 0 100 Q 30 50 100 0"
							fill="none"
							stroke="rgba(255,255,255,0.4)"
							strokeWidth="2"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
				</div>
			)}

			{/* Fade Out Handle & Overlay */}
			{fadeOutPx > 0 && (
				<div
					className="absolute right-0 top-0 bottom-0 pointer-events-none"
					style={{ width: fadeOutPx }}
				>
					{/* Fade gradient overlay */}
					<div
						className="absolute inset-0"
						style={{
							background: "linear-gradient(to left, rgba(0,0,0,0.3), transparent)",
						}}
					/>
					{/* Fade curve visual */}
					<svg
						className="absolute inset-0 pointer-events-none"
						preserveAspectRatio="none"
						viewBox="0 0 100 100"
					>
						<path
							d="M 0 0 Q 70 50 100 100"
							fill="none"
							stroke="rgba(255,255,255,0.4)"
							strokeWidth="2"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
				</div>
			)}

			{/* Draggable Fade In Handle */}
			<div
				className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize pointer-events-auto hover:bg-primary/30 transition-colors"
				style={{
					left: fadeInPx > 0 ? fadeInPx - 4 : 0,
					opacity: draggingFade === "fadeIn" ? 1 : 0.5,
				}}
				onPointerDown={(e) => handleFadePointerDown("fadeIn", e)}
				onPointerMove={(e) => handleFadePointerMove("fadeIn", e)}
				onPointerUp={handleFadePointerUp}
				aria-label={`Fade in: ${clip.fadeIn ?? 0}ms`}
				role="slider"
				aria-valuemin={0}
				aria-valuenow={clip.fadeIn ?? 0}
			>
				<div className="absolute inset-0 bg-primary/50 rounded-full" />
			</div>

			{/* Draggable Fade Out Handle */}
			<div
				className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize pointer-events-auto hover:bg-primary/30 transition-colors"
				style={{
					right: fadeOutPx > 0 ? fadeOutPx - 4 : 0,
					opacity: draggingFade === "fadeOut" ? 1 : 0.5,
				}}
				onPointerDown={(e) => handleFadePointerDown("fadeOut", e)}
				onPointerMove={(e) => handleFadePointerMove("fadeOut", e)}
				onPointerUp={handleFadePointerUp}
				aria-label={`Fade out: ${clip.fadeOut ?? 0}ms`}
				role="slider"
				aria-valuemin={0}
				aria-valuenow={clip.fadeOut ?? 0}
			>
				<div className="absolute inset-0 bg-primary/50 rounded-full" />
			</div>
		</>
	);
}

