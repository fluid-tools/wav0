"use client";

import type { SamplerPad } from "@wav0/daw-sdk";
import { Upload } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SamplerPadItemProps = {
	pad: SamplerPad;
	keyLabel: string;
	isSelected: boolean;
	isActive: boolean;
	onClick: () => void;
	onTrigger: () => void;
	onRelease: () => void;
	onFileDrop: (file: File) => void;
};

export const SamplerPadItem = memo(function SamplerPadItem({
	pad,
	keyLabel,
	isSelected,
	isActive,
	onClick,
	onTrigger,
	onRelease,
	onFileDrop,
}: SamplerPadItemProps) {
	const [isDragOver, setIsDragOver] = useState(false);
	const [isPointerPressed, setIsPointerPressed] = useState(false);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const hasSample = pad.audioBuffer !== null;
	const isPressed = isPointerPressed || isActive;

	// Draw waveform when sample is loaded
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !pad.audioBuffer) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();

		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.scale(dpr, dpr);

		const width = rect.width;
		const height = rect.height;

		ctx.clearRect(0, 0, width, height);

		const data = pad.audioBuffer.getChannelData(0);
		const step = Math.ceil(data.length / width);
		const amp = height / 2;

		ctx.beginPath();
		ctx.strokeStyle = isSelected
			? "hsl(var(--primary))"
			: "hsl(var(--muted-foreground))";
		ctx.lineWidth = 1;

		for (let i = 0; i < width; i++) {
			let min = 1.0;
			let max = -1.0;

			for (let j = 0; j < step; j++) {
				const datum = data[i * step + j];
				if (datum < min) min = datum;
				if (datum > max) max = datum;
			}

			const y1 = amp + min * amp * 0.8;
			const y2 = amp + max * amp * 0.8;

			if (i === 0) {
				ctx.moveTo(i, y1);
			}
			ctx.lineTo(i, y1);
			ctx.lineTo(i, y2);
		}

		ctx.stroke();
	}, [pad.audioBuffer, isSelected]);

	// File input change handler
	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				onFileDrop(file);
			}
			e.target.value = "";
		},
		[onFileDrop],
	);

	// Pointer down - select pad, trigger if has sample, or open file picker if empty
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			onClick();

			if (hasSample) {
				setIsPointerPressed(true);
				onTrigger();
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			} else {
				// No sample - open file picker
				fileInputRef.current?.click();
			}
		},
		[onClick, onTrigger, hasSample],
	);

	// Pointer up - release if has sample
	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (hasSample && isPointerPressed) {
				setIsPointerPressed(false);
				onRelease();
				(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
			}
		},
		[onRelease, hasSample, isPointerPressed],
	);

	// Drag handlers
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver(false);

			const files = Array.from(e.dataTransfer.files);
			const audioFile = files.find(
				(f) =>
					f.type.startsWith("audio/") ||
					/\.(wav|mp3|ogg|flac|m4a|aac)$/i.test(f.name),
			);

			if (audioFile) {
				onFileDrop(audioFile);
			}
		},
		[onFileDrop],
	);

	return (
		<>
			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac"
				className="hidden"
				onChange={handleFileChange}
			/>

			{/* Pad button */}
			<button
				type="button"
				className={cn(
					"relative flex size-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 transition-all select-none md:size-28 lg:size-32",
					"bg-card hover:bg-muted/50",
					isSelected && "border-primary ring-2 ring-primary/20",
					!isSelected && "border-border",
					isPressed && "scale-95 bg-primary/20 border-primary",
					isDragOver && "border-dashed border-primary bg-primary/10",
				)}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				{/* Key label */}
				<span
					className={cn(
						"absolute top-1 left-1.5 text-[10px] font-medium",
						isPressed ? "text-primary" : "text-muted-foreground",
					)}
				>
					{keyLabel}
				</span>

				{hasSample ? (
					<>
						{/* Waveform */}
						<canvas
							ref={canvasRef}
							className="absolute inset-0 size-full p-2"
							style={{ imageRendering: "pixelated" }}
						/>
						{/* Sample name */}
						<span className="absolute right-1 bottom-1 left-1 truncate text-center text-[10px] text-muted-foreground">
							{pad.name}
						</span>
					</>
				) : (
					/* Empty state - visual only, click handled by button */
					<div className="flex flex-col items-center gap-1 text-muted-foreground pointer-events-none">
						<Upload className="size-5 opacity-50" />
						<span className="text-[10px]">Drop or click</span>
					</div>
				)}

				{/* Muted overlay */}
				{pad.muted && (
					<div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
						<span className="text-xs font-medium text-muted-foreground">
							MUTED
						</span>
					</div>
				)}

				{/* Active flash */}
				{isPressed && hasSample && (
					<div className="pointer-events-none absolute inset-0 rounded-lg bg-primary/10" />
				)}
			</button>
		</>
	);
});
