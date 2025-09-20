"use client";

import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
	DAW_PIXELS_PER_SECOND_AT_ZOOM_1,
} from "@/lib/constants";
import { DAW_HEIGHTS } from "@/lib/constants/daw-design";
import {
	loadAudioFileAtom,
	projectEndPositionAtom,
	selectedTrackIdAtom,
	timelineAtom,
	trackHeightZoomAtom,
	tracksAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";
import { formatDuration } from "@/lib/storage/opfs";

export function DAWTrackContent() {
	const [tracks] = useAtom(tracksAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [, loadAudioFile] = useAtom(loadAudioFileAtom);
	const [timeline] = useAtom(timelineAtom);
	const [trackHeightZoom] = useAtom(trackHeightZoomAtom);
	const [projectEndPosition] = useAtom(projectEndPositionAtom);
	const [resizing, setResizing] = useState<{
		trackId: string;
		type: "start" | "end";
		startX: number;
		startValue: number;
	} | null>(null);

	const [dragging, setDragging] = useState<{
		trackId: string;
		startX: number;
		startTime: number;
	} | null>(null);

	const containerRef = useRef<HTMLDivElement>(null);
	const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

	const pixelsPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * timeline.zoom) / 1000; // px/ms

	const handleTrackDrop = async (trackId: string, e: React.DragEvent) => {
		e.preventDefault();
		setDragOverTrackId(null);

		const files = Array.from(e.dataTransfer.files).filter((file) =>
			file.type.startsWith("audio/"),
		);

		if (files.length === 0) return;

		const file = files[0];

		// Calculate drop position
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const startTime = x / pixelsPerMs;

		try {
			// Use MediaBunny integration to load audio file into existing track
			const updatedTrack = await loadAudioFile(file, trackId);
			
			// Update the track position based on drop location
			updateTrack(trackId, {
				startTime,
			});
			
			console.log('Audio file loaded successfully into track:', updatedTrack.name);
		} catch (error) {
			console.error("Error loading audio file:", error);
		}
	};

	const handleResizeStart = (
		trackId: string,
		type: "start" | "end",
		e: React.MouseEvent,
	) => {
		e.preventDefault();
		e.stopPropagation();

		const track = tracks.find((t) => t.id === trackId);
		if (!track) return;

		setResizing({
			trackId,
			type,
			startX: e.clientX,
			startValue: type === "start" ? track.trimStart : track.trimEnd,
		});
	};

	const handleClipDragStart = (trackId: string, e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const track = tracks.find((t) => t.id === trackId);
		if (!track) return;

		setDragging({
			trackId,
			startX: e.clientX,
			startTime: track.startTime,
		});
	};

	// Attach document-level pointer listeners while resizing or dragging
	useEffect(() => {
		if (!resizing && !dragging) return;

		const onMove = (e: MouseEvent) => {
			if (resizing) {
				const deltaX = e.clientX - resizing.startX;
				const deltaTime = deltaX / pixelsPerMs;

				const track = tracks.find((t) => t.id === resizing.trackId);
				if (!track) return;

				if (resizing.type === "start") {
					const newTrimStart = Math.max(
						0,
						Math.min(resizing.startValue + deltaTime, track.trimEnd - 50), // 50ms minimum
					);
					updateTrack(resizing.trackId, { trimStart: newTrimStart });
				} else {
					const newTrimEnd = Math.min(
						track.duration,
						Math.max(resizing.startValue + deltaTime, track.trimStart + 50), // 50ms minimum
					);
					updateTrack(resizing.trackId, { trimEnd: newTrimEnd });
				}
			}

			if (dragging) {
				const deltaX = e.clientX - dragging.startX;
				const deltaTime = deltaX / pixelsPerMs;
				const newStartTime = Math.max(0, dragging.startTime + deltaTime);
				updateTrack(dragging.trackId, { startTime: newStartTime });
			}
		};

		const onUp = () => {
			setResizing(null);
			setDragging(null);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [resizing, dragging, pixelsPerMs, tracks, updateTrack]);

	return (
		<div ref={containerRef} className="relative w-full h-full">
			{tracks.map((track, index) => {
				// Calculate track position using global height
				const trackHeight = Math.round(DAW_HEIGHTS.TRACK_ROW * trackHeightZoom);
				const trackY = index * trackHeight;
				const trackWidth = (track.trimEnd - track.trimStart) * pixelsPerMs;
				const trackX = track.startTime * pixelsPerMs;

				return (
					<div
						key={track.id}
						className={`absolute border-b border-border/50 transition-colors ${
							selectedTrackId === track.id ? "bg-muted/30" : ""
						}`}
						style={{
							top: trackY,
							height: trackHeight,
							left: 0,
							right: 0,
							padding: '12px',
						}}
					>
						{/* Track Drop Zone */}
						<button
							type="button"
							className={`absolute inset-0 w-full h-full border-none p-0 cursor-default transition-colors ${
								dragOverTrackId === track.id 
									? "bg-primary/10 border-2 border-primary border-dashed" 
									: "bg-transparent"
							}`}
							onDrop={(e) => handleTrackDrop(track.id, e)}
							onDragOver={(e) => e.preventDefault()}
							onDragEnter={() => setDragOverTrackId(track.id)}
							onDragLeave={(e) => {
								// Only clear if leaving the entire track area
								const rect = e.currentTarget.getBoundingClientRect();
								const x = e.clientX;
								const y = e.clientY;
								if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
									setDragOverTrackId(null);
								}
							}}
							onClick={() => setSelectedTrackId(track.id)}
							style={{ padding: '12px' }}
							aria-label={`Track ${track.name} drop zone`}
						>
							{/* Track Audio Clip */}
							{track.duration > 0 && (
								// biome-ignore lint/a11y/useSemanticElements: Avoiding nested button hydration error
								<div
									className={`absolute top-0 bottom-0 rounded-md border-2 transition-all cursor-move select-none ${
										selectedTrackId === track.id
											? "border-primary bg-primary/20"
											: "border-border bg-muted/50 hover:bg-muted/70"
									} ${track.muted ? "opacity-50" : ""} ${
										dragging?.trackId === track.id ? "opacity-80" : ""
									}`}
									style={{
										left: trackX,
										width: Math.max(trackWidth, 20),
										backgroundColor: `${track.color}20`,
										borderColor: track.color,
									}}
									onClick={() => {
										if (!dragging) setSelectedTrackId(track.id);
									}}
									onMouseDown={(e) => {
										// Only start drag if clicking on the main body, not resize handles
										const rect = e.currentTarget.getBoundingClientRect();
										const x = e.clientX - rect.left;
										const isNearLeftEdge = x < 8;
										const isNearRightEdge = x > rect.width - 8;
										
										if (!isNearLeftEdge && !isNearRightEdge) {
											handleClipDragStart(track.id, e);
										} else {
											setSelectedTrackId(track.id);
										}
									}}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											setSelectedTrackId(track.id);
										}
									}}
									aria-label={`Select audio clip: ${track.name}`}
								>
									{/* Resize Handles */}
									{/* biome-ignore lint/a11y/useSemanticElements: Avoiding nested button hydration error */}
									<div
										className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-primary/50 opacity-0 hover:opacity-100"
										onMouseDown={(e) => handleResizeStart(track.id, "start", e)}
										role="button"
										tabIndex={0}
										aria-label="Resize track start"
									/>
									{/* biome-ignore lint/a11y/useSemanticElements: Avoiding nested button hydration error */}
									<div
										className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-primary/50 opacity-0 hover:opacity-100"
										onMouseDown={(e) => handleResizeStart(track.id, "end", e)}
										role="button"
										tabIndex={0}
										aria-label="Resize track end"
									/>

								{/* Track Label */}
								<div className="absolute inset-2 flex flex-col justify-center pointer-events-none">
									<div className="text-xs font-medium truncate text-left">
										{track.name}
									</div>
									<div className="text-xs text-muted-foreground text-left">
										{formatDuration((track.trimEnd - track.trimStart) / 1000)}
									</div>
								</div>

									{/* Waveform placeholder */}
									<div className="absolute bottom-1 left-2 right-2 h-4 bg-current opacity-20 rounded-sm pointer-events-none" />
								</div>
							)}

							{/* Drop Zone Indicator - Only show when no audio */}
							{track.duration === 0 && (
								<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
									Drop audio file here
								</div>
							)}
						</button>
					</div>
				);
			})}

			{/* Project end marker */}
			<div
				className="absolute top-0 bottom-0 w-px bg-yellow-500/70 z-40"
				style={{ left: projectEndPosition }}
				title="Project End"
			/>
			
			{/* Buffer/dead space overlay */}
			<div
				className="absolute top-0 bottom-0 bg-muted/10 pointer-events-none z-30"
				style={{ 
					left: projectEndPosition,
					right: 0,
				}}
			/>

			{/* Grid Lines */}
			<div className="absolute inset-0 pointer-events-none">
				{Array.from({ length: Math.ceil(2000 / 100) }).map((_, i) => (
					<div
						key={`grid-line-${i * 100}`}
						className="absolute top-0 bottom-0 w-px bg-border/20"
						style={{ left: i * 100 }}
					/>
				))}
			</div>
		</div>
	);
}