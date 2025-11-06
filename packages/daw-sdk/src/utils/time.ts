/**
 * Time conversion and formatting utilities
 * Pure functions for time manipulation in a DAW context
 */

export namespace time {
	/**
	 * Format duration in milliseconds to MM:SS.mmm format
	 */
	export function formatDuration(
		durationMs: number,
		options: {
			precision?: "auto" | "ms" | "deciseconds" | "seconds";
			pxPerMs?: number;
		} = {},
	): string {
		if (!Number.isFinite(durationMs)) return "0:00";
		const totalMs = Math.max(0, Math.round(durationMs));
		const minutes = Math.floor(totalMs / 60000);
		const seconds = Math.floor((totalMs % 60000) / 1000);
		const milliseconds = totalMs % 1000;
		const deciseconds = Math.floor(milliseconds / 100);

		let precision = options.precision ?? "auto";
		if (precision === "auto" && options.pxPerMs !== undefined) {
			const pxPerMs = options.pxPerMs;
			if (pxPerMs >= 0.5) {
				precision = "ms";
			} else if (pxPerMs >= 0.1) {
				precision = "deciseconds";
			} else {
				precision = "seconds";
			}
		} else if (precision === "auto") {
			precision = "ms";
		}

		const secStr = seconds.toString().padStart(2, "0");
		const msStr = milliseconds.toString().padStart(3, "0");

		switch (precision) {
			case "ms":
				return `${minutes}:${secStr}.${msStr}`;
			case "deciseconds":
				return `${minutes}:${secStr}.${deciseconds}`;
			default:
				return `${minutes}:${secStr}`;
		}
	}

	/**
	 * Convert seconds to milliseconds
	 */
	export function secondsToMs(seconds: number): number {
		return seconds * 1000;
	}

	/**
	 * Convert milliseconds to seconds
	 */
	export function msToSeconds(ms: number): number {
		return ms / 1000;
	}

	/**
	 * Convert milliseconds to pixels
	 */
	export function msToPixels(ms: number, pxPerMs: number): number {
		return ms * pxPerMs;
	}

	/**
	 * Convert pixels to milliseconds
	 */
	export function pixelsToMs(px: number, pxPerMs: number): number {
		return px / pxPerMs;
	}

	/**
	 * Unified time-to-pixel conversion with scroll offset
	 * This is the SINGLE SOURCE OF TRUTH for all time-to-pixel conversions
	 * Used by both grid markers and playhead for perfect synchronization
	 * @param ms - Time in milliseconds
	 * @param pxPerMs - Pixels per millisecond (zoom level)
	 * @param scrollLeft - Horizontal scroll offset in pixels
	 * @returns Pixel position in viewport coordinates (0 = left edge of viewport)
	 */
	export function timeToPixel(
		ms: number,
		pxPerMs: number,
		scrollLeft: number,
	): number {
		if (
			!Number.isFinite(ms) ||
			!Number.isFinite(pxPerMs) ||
			!Number.isFinite(scrollLeft)
		) {
			return 0;
		}
		// Convert time to absolute pixel position, then subtract scroll offset
		// This ensures exact same calculation path for grid and playhead
		return ms * pxPerMs - scrollLeft;
	}

	/**
	 * Unified pixel-to-time conversion with scroll offset
	 * Inverse of timeToPixel - converts viewport pixel position to time
	 * @param px - Pixel position in viewport coordinates (0 = left edge of viewport)
	 * @param pxPerMs - Pixels per millisecond (zoom level)
	 * @param scrollLeft - Horizontal scroll offset in pixels
	 * @returns Time in milliseconds
	 */
	export function pixelToTime(
		px: number,
		pxPerMs: number,
		scrollLeft: number,
	): number {
		if (!Number.isFinite(px) || !Number.isFinite(pxPerMs) || pxPerMs <= 0) {
			return 0;
		}
		// Convert viewport pixel to absolute pixel, then to time
		return (px + scrollLeft) / pxPerMs;
	}

	/**
	 * Musical timebase conversions
	 */
	export function msToBeats(
		ms: number,
		bpm: number,
		signature?: { num: number; den: number },
	): number {
		const seconds = ms / 1000;
		const baseBeats = seconds * (bpm / 60);
		if (!signature) return baseBeats;
		const denScale = 4 / signature.den;
		return baseBeats / denScale;
	}

	export function beatsToMs(
		beats: number,
		bpm: number,
		signature?: { num: number; den: number },
	): number {
		const denScale = signature ? 4 / signature.den : 1;
		const notatedBeats = beats / denScale;
		const seconds = notatedBeats * (60 / bpm);
		return seconds * 1000;
	}

	export function msToBarsBeats(
		ms: number,
		bpm: number,
		signature: { num: number; den: number },
	): { bar: number; beat: number; tick: number } {
		const beats = msToBeats(ms, bpm, signature);
		const beatsPerBar = signature.num;
		const bar = Math.floor(beats / beatsPerBar);
		const beat = Math.floor(beats % beatsPerBar);
		const tick = Math.floor((beats - Math.floor(beats)) * 960);
		return { bar: bar + 1, beat: beat + 1, tick };
	}

	export function barsBeatsToMs(
		pos: { bar: number; beat: number; tick?: number },
		bpm: number,
		signature: { num: number; den: number },
	): number {
		const beatsPerBar = signature.num;
		const totalBeats =
			(pos.bar - 1) * beatsPerBar + (pos.beat - 1) + (pos.tick ?? 0) / 960;
		return beatsToMs(totalBeats, bpm, signature);
	}

	export function snapTimeMs(
		timeMs: number,
		grid: {
			mode: "time" | "bars";
			resolution: "1/1" | "1/2" | "1/4" | "1/8" | "1/16";
			triplet?: boolean;
			swing?: number;
		},
		bpm: number,
		signature: { num: number; den: number },
	): number {
		if (grid.mode === "time") return timeMs;
		const res = grid.resolution;
		const denom = Number(res.split("/")[1]);
		const beatsPerBar = signature.num;
		const baseDivisionBeats = beatsPerBar / denom;
		const beatPos = msToBeats(timeMs, bpm, signature);

		let division = baseDivisionBeats;
		if (grid.triplet) division = baseDivisionBeats / 3;

		const snapped = Math.round(beatPos / division) * division;
		const isEven = Math.round(beatPos / division) % 2 === 0;
		if (grid.swing && grid.swing > 0 && !grid.triplet) {
			const swing01 = grid.swing / 100;
			const bias = division * (isEven ? 0 : swing01 * (2 / 3 - 1 / 2));
			return beatsToMs(snapped + bias, bpm, signature);
		}
		return beatsToMs(snapped, bpm, signature);
	}

	export function formatBarsBeatsTicks(
		ms: number,
		bpm: number,
		signature: { num: number; den: number },
	): string {
		const { bar, beat, tick } = msToBarsBeats(ms, bpm, signature);
		const tickStr = tick.toString().padStart(3, "0");
		return `${bar}.${beat}.${tickStr}`;
	}

	export function getDivisionBeats(
		res: "1/1" | "1/2" | "1/4" | "1/8" | "1/16",
		signature: { num: number; den: number },
	): number {
		const denom = Number(res.split("/")[1]);
		const beatsPerBar = signature.num;
		return beatsPerBar / denom;
	}

	export function generateBarsGrid(
		widthPx: number,
		pxPerMs: number,
		bpm: number,
		signature: { num: number; den: number },
		res: "1/1" | "1/2" | "1/4" | "1/8" | "1/16",
		triplet: boolean,
		swing: number,
	): Array<{
		timeMs: number;
		posPx: number;
		emphasis: "measure" | "beat" | "sub";
	}> {
		if (pxPerMs <= 0 || widthPx <= 0) return [];
		const out: Array<{
			timeMs: number;
			posPx: number;
			emphasis: "measure" | "beat" | "sub";
		}> = [];
		const secondsPerBeat = (60 / bpm) * (4 / signature.den);
		const beatsPerBar = signature.num;
		const divisionBeats = getDivisionBeats(res, signature);
		const subdivBeats = triplet ? divisionBeats / 3 : divisionBeats;

		const msPerBeat = secondsPerBeat * 1000;
		const msPerBar = beatsPerBar * msPerBeat;
		const maxBars = Math.ceil(widthPx / pxPerMs / msPerBar) + 2;

		for (let bar = 0; bar < maxBars; bar++) {
			const barStartMs = bar * msPerBar;
			const barPx = barStartMs * pxPerMs;
			if (barPx > widthPx) break;
			out.push({ timeMs: barStartMs, posPx: barPx, emphasis: "measure" });

			for (let beat = 1; beat < beatsPerBar; beat++) {
				const beatMs = barStartMs + beat * msPerBeat;
				const beatPx = beatMs * pxPerMs;
				if (beatPx > widthPx) break;
				out.push({ timeMs: beatMs, posPx: beatPx, emphasis: "beat" });
			}

			const subdivMs = subdivBeats * msPerBeat;
			const divisionsPerBar = beatsPerBar / subdivBeats;
			for (let i = 1; i < divisionsPerBar; i++) {
				const subTime = barStartMs + i * subdivMs;
				let subPx = subTime * pxPerMs;
				if (swing > 0 && !triplet) {
					const isEven = i % 2 === 0;
					const swing01 = swing / 100;
					const bias = isEven
						? 0
						: swing01 * (2 / 3 - 1 / 2) * subdivMs * pxPerMs;
					subPx += bias;
				}
				if (subPx > widthPx) break;
				out.push({ timeMs: subTime, posPx: subPx, emphasis: "sub" });
			}
		}

		return out;
	}

	export function computeSubdivisionMs(
		bpm: number,
		signature: { num: number; den: number },
		res: "1/1" | "1/2" | "1/4" | "1/8" | "1/16",
		triplet: boolean,
	): number {
		const secondsPerBeat = (60 / bpm) * (4 / signature.den);
		const divisionBeats = getDivisionBeats(res, signature);
		const subdivBeats = triplet ? divisionBeats / 3 : divisionBeats;
		return subdivBeats * secondsPerBeat * 1000;
	}

	// ===== Time Grid Generation =====

	export type TimeMarker = {
		ms: number;
		label: string;
	};

	export type TimeSteps = {
		majorMs: number;
		minorMs: number;
		labelFormat: "ss.ms" | "mm:ss";
	};

	export type TimeGrid = {
		majors: TimeMarker[];
		minors: number[];
	};

	/**
	 * Choose adaptive time steps based on pixels per millisecond
	 */
	export function chooseTimeSteps(pxPerMs: number): TimeSteps {
		const candidateSteps = [
			100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000,
		];

		let majorMs = candidateSteps[candidateSteps.length - 1];
		for (const step of candidateSteps) {
			if (step * pxPerMs >= 80) {
				majorMs = step;
				break;
			}
		}

		const minorMs = Math.max(50, Math.round(majorMs / 5 / 10) * 10);
		const labelFormat = majorMs >= 1000 ? "mm:ss" : "ss.ms";

		return { majorMs, minorMs, labelFormat };
	}

	/**
	 * Format time for display
	 */
	export function formatTimeMs(ms: number, format: "ss.ms" | "mm:ss"): string {
		if (format === "mm:ss") {
			const totalSeconds = Math.floor(ms / 1000);
			const minutes = Math.floor(totalSeconds / 60);
			const seconds = totalSeconds % 60;
			return `${minutes}:${seconds.toString().padStart(2, "0")}`;
		}

		const seconds = Math.floor(ms / 1000);
		const msRemainder = Math.round((ms % 1000) / 100);
		return `${seconds}.${msRemainder}`;
	}

	/**
	 * Generate time grid markers for viewport
	 * Uses pixel viewport to avoid floating point errors from time viewport calculations
	 * @param params.scrollLeft - Horizontal scroll offset in pixels
	 * @param params.width - Viewport width in pixels
	 * @param params.pxPerMs - Pixels per millisecond (zoom level)
	 * @param params.snapIntervalMs - Optional snap interval in milliseconds. When provided, generates grid markers at exact snap intervals.
	 */
	export function generateTimeGrid(params: {
		scrollLeft: number;
		width: number;
		pxPerMs: number;
		snapIntervalMs?: number;
	}): TimeGrid {
		const { scrollLeft, width, pxPerMs, snapIntervalMs } = params;

		if (pxPerMs <= 0 || width <= 0) {
			return { majors: [], minors: [] };
		}

		// Convert pixel viewport to time bounds using unified pixelToTime function
		// This ensures we use the exact same conversion logic everywhere
		const viewStartMs = pixelToTime(0, pxPerMs, scrollLeft);
		const viewEndMs = pixelToTime(width, pxPerMs, scrollLeft);

		// If snap interval is provided and snap is enabled, use snap-based grid
		// Generate markers at exact snap intervals, filter by pixel visibility
		if (snapIntervalMs !== undefined && snapIntervalMs > 0) {
			const majors: TimeMarker[] = [];
			const minors: number[] = [];

			// Determine major and minor intervals based on snap interval
			// Major: 4x snap interval, Minor: snap interval
			const minorMs = snapIntervalMs;
			const majorMs = snapIntervalMs * 4;
			const labelFormat = majorMs >= 1000 ? "mm:ss" : "ss.ms";

			// Find starting integer multiples - extend slightly beyond viewport for smooth scrolling
			const startMajorMultiple = Math.floor(viewStartMs / majorMs) - 1;
			const endMajorMultiple = Math.ceil(viewEndMs / majorMs) + 1;

			// Generate major markers using integer multiples (avoids floating point drift)
			for (let i = startMajorMultiple; i <= endMajorMultiple; i++) {
				const ms = i * majorMs;
				// Convert to pixel position using unified timeToPixel function
				const px = timeToPixel(ms, pxPerMs, scrollLeft);
				// Only include markers visible in viewport (with small margin for smooth scrolling)
				if (px >= -1 && px <= width + 1) {
					majors.push({ ms, label: formatTimeMs(ms, labelFormat) });
				}
			}

			// Generate minor markers using integer multiples
			const startMinorMultiple = Math.floor(viewStartMs / minorMs) - 1;
			const endMinorMultiple = Math.ceil(viewEndMs / minorMs) + 1;

			for (let i = startMinorMultiple; i <= endMinorMultiple; i++) {
				const ms = i * minorMs;
				// Skip if this is a major marker
				if (ms % majorMs === 0) continue;
				// Convert to pixel position using unified timeToPixel function
				const px = timeToPixel(ms, pxPerMs, scrollLeft);
				// Only include markers visible in viewport (with small margin for smooth scrolling)
				if (px >= -1 && px <= width + 1) {
					minors.push(ms);
				}
			}

			return { majors, minors };
		}

		// Fall back to adaptive steps when snap interval not provided
		const { majorMs, minorMs, labelFormat } = chooseTimeSteps(pxPerMs);

		const majors: TimeMarker[] = [];
		const minors: number[] = [];

		// Find first major marker before viewport start
		const firstMajorMultiple = Math.floor(viewStartMs / majorMs) - 1;
		const endMajorMultiple = Math.ceil(viewEndMs / majorMs) + 1;

		// Generate major markers
		for (let i = firstMajorMultiple; i <= endMajorMultiple; i++) {
			const ms = i * majorMs;
			const px = timeToPixel(ms, pxPerMs, scrollLeft);
			if (px >= -1 && px <= width + 1) {
				majors.push({ ms, label: formatTimeMs(ms, labelFormat) });
			}
		}

		// Generate minor markers
		const firstMinorMultiple = Math.floor(viewStartMs / minorMs) - 1;
		const endMinorMultiple = Math.ceil(viewEndMs / minorMs) + 1;

		for (let i = firstMinorMultiple; i <= endMinorMultiple; i++) {
			const ms = i * minorMs;
			if (ms % majorMs === 0) continue;
			const px = timeToPixel(ms, pxPerMs, scrollLeft);
			if (px >= -1 && px <= width + 1) {
				minors.push(ms);
			}
		}

		return { majors, minors };
	}
}
