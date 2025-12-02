"use client";
import type { Track } from "@wav0/daw-sdk";
import { useMemo } from "react";

export type ExportPreviewLanesProps = {
	width: number;
	height: number;
	tracks: Track[];
	range: { startMs: number; endMs: number };
	pxPerMs?: number; // computed as width / (range span) if omitted
};

export function ExportPreviewLanes({
	width,
	height,
	tracks,
	range,
	pxPerMs,
}: ExportPreviewLanesProps) {
	const computedPxPerMs = pxPerMs ?? width / (range.endMs - range.startMs);
	const rowHeight = 16;
	const padding = 4;

	// Memoize SVG elements for performance
	const svgElements = useMemo(() => {
		if (range.endMs <= range.startMs) return null;

		const elements: React.ReactElement[] = [];
		let totalTiles = 0;

		// Draw tracks
		tracks.forEach((track, trackIndex) => {
			const y = trackIndex * rowHeight + padding;

			// Draw track background (zebra pattern)
			elements.push(
				<rect
					key={`track-bg-${track.id || trackIndex}`}
					x={0}
					y={y}
					width={width}
					height={rowHeight - 2}
					style={{
						fill:
							trackIndex % 2 === 0 ? "var(--muted)" : "var(--muted-foreground)",
					}}
					rx={2}
					ry={2}
				/>,
			);

			// Draw track clips
			track.clips?.forEach((clip, clipIndex) => {
				// Calculate audible windows
				const trimStart = clip.trimStart || 0;
				const trimEnd = clip.trimEnd || clip.sourceDurationMs || 0;
				const clipDuration = trimEnd - trimStart;

				if (clipDuration <= 0) return;

				const audibleStart = Math.max(clip.startTime, range.startMs);
				const audibleEnd = Math.min(clip.startTime + clipDuration, range.endMs);

				// Handle looped clips
				if (clip.loop) {
					const cycleLen = clipDuration;
					const loopEnd = clip.loopEnd || Infinity;

					// Find first cycle start within range
					let firstCycleStart = clip.startTime;
					if (range.startMs > clip.startTime) {
						// Use Math.floor to find the cycle that contains or precedes range.startMs
						// Cycles starting before the range but extending into it render with negative x,
						// which is correctly clipped by the SVG to show only the audible portion
						const cyclesOffset = Math.floor(
							(range.startMs - clip.startTime) / cycleLen,
						);
						firstCycleStart = clip.startTime + cyclesOffset * cycleLen;
					}

					// Tile cycles across the range
					let currentStart = firstCycleStart;
					let cycleIndex = 0;
					while (currentStart < range.endMs && currentStart < loopEnd) {
						const currentEnd = Math.min(
							currentStart + cycleLen,
							range.endMs,
							loopEnd,
						);
						if (currentEnd > range.startMs) {
							const x = (currentStart - range.startMs) * computedPxPerMs;
							const w = (currentEnd - currentStart) * computedPxPerMs;

							// Draw rounded clip rectangle
							elements.push(
								<rect
									key={`clip-${track.id || trackIndex}-${clip.id || clipIndex}-${cycleIndex}`}
									x={x}
									y={y + 2}
									width={w}
									height={rowHeight - 6}
									style={{ fill: "var(--primary)", stroke: "var(--primary)" }}
									rx={2}
									ry={2}
									strokeWidth={0.5}
								/>,
							);

							// Draw loop dividers (dotted lines inside the rectangle)
							if (cycleIndex > 0 && w > 20) {
								elements.push(
									<line
										key={`divider-${track.id || trackIndex}-${clip.id || clipIndex}-${cycleIndex}`}
										x1={x}
										y1={y + 2}
										x2={x}
										y2={y + rowHeight - 4}
										style={{ stroke: "var(--primary)" }}
										strokeWidth={1}
										strokeDasharray="2,2"
										opacity={0.3}
									/>,
								);
							}

							totalTiles++;
						}
						currentStart += cycleLen;
						cycleIndex++;
					}
				} else {
					// One-shot clip
					if (audibleEnd > audibleStart) {
						const x = (audibleStart - range.startMs) * computedPxPerMs;
						const w = (audibleEnd - audibleStart) * computedPxPerMs;

						// Draw rounded clip rectangle
						elements.push(
							<rect
								key={`clip-${track.id || trackIndex}-${clip.id || clipIndex}`}
								x={x}
								y={y + 2}
								width={w}
								height={rowHeight - 6}
								style={{ fill: "var(--primary)", stroke: "var(--primary)" }}
								rx={2}
								ry={2}
								strokeWidth={0.5}
							/>,
						);

						totalTiles++;
					}
				}
			});

			// Draw track label
			elements.push(
				<text
					key={`label-${track.id || trackIndex}`}
					x={4}
					y={y + 12}
					fontSize="10"
					fontFamily="sans-serif"
					style={{ fill: "var(--muted-foreground)" }}
					className="select-none"
				>
					Track {trackIndex + 1}
				</text>,
			);
		});

		// Draw time markers
		const timeStep = (range.endMs - range.startMs) / 8; // 8 time markers
		for (let i = 0; i <= 8; i++) {
			const timeMs = range.startMs + i * timeStep;
			const x = (timeMs - range.startMs) * computedPxPerMs;

			elements.push(
				<line
					key={`time-marker-${i}`}
					x1={x}
					y1={0}
					x2={x}
					y2={height}
					style={{ stroke: "var(--border)" }}
					strokeWidth={1}
				/>,
			);

			// Time label
			elements.push(
				<text
					key={`time-label-${i}`}
					x={x + 2}
					y={12}
					fontSize="8"
					fontFamily="sans-serif"
					style={{ fill: "var(--muted-foreground)" }}
					className="select-none"
				>
					{(timeMs / 1000).toFixed(1)}s
				</text>,
			);
		}

		// Performance guard: if too many tiles, return simplified version
		if (totalTiles > 3000) {
			return (
				<>
					{/* Simplified background heatmap */}
					<rect
						x={0}
						y={0}
						width={width}
						height={height}
						style={{ fill: "var(--muted)" }}
						rx={4}
						ry={4}
					/>
					{/* Show track count and duration info */}
					<text
						x={width / 2}
						y={height / 2 - 8}
						fontSize="12"
						fontFamily="sans-serif"
						style={{ fill: "var(--muted-foreground)" }}
						textAnchor="middle"
						className="select-none"
					>
						Large project ({tracks.length} tracks, {totalTiles} tiles)
					</text>
					<text
						x={width / 2}
						y={height / 2 + 8}
						fontSize="10"
						fontFamily="sans-serif"
						style={{ fill: "var(--muted-foreground)" }}
						textAnchor="middle"
						className="select-none"
					>
						Duration: {((range.endMs - range.startMs) / 1000).toFixed(1)}s
					</text>
				</>
			);
		}

		return elements;
	}, [tracks, range, computedPxPerMs, width, height]);

	return (
		<svg
			width={width}
			height={height}
			className="border rounded bg-background"
			style={{ maxWidth: "100%", height: "auto" }}
			aria-label="Export preview lanes"
		>
			<title>Export Preview Lanes</title>
			{svgElements}
		</svg>
	);
}
