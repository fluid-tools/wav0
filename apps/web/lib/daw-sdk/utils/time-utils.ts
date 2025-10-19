/**
 * Time conversion and formatting utilities
 */

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
 * Snap time to grid based on BPM and grid division
 */
export function snapToGrid(
	timeMs: number,
	bpm: number,
	gridDivision: number = 16, // 16th note by default
): number {
	const secondsPerBeat = 60 / bpm;
	const snapSeconds = secondsPerBeat / (gridDivision / 4); // Convert to quarter note divisions
	const rawSeconds = timeMs / 1000;
	const snappedSeconds = Math.round(rawSeconds / snapSeconds) * snapSeconds;
	return snappedSeconds * 1000;
}

/**
 * Calculate beat markers for timeline
 */
export function calculateBeatMarkers(
	bpm: number,
	timelineWidthPx: number,
	pxPerMs: number,
): Array<{
	beat: number;
	time: number;
	position: number;
	isMeasure: boolean;
}> {
	if (pxPerMs <= 0) return [];
	const markers = [];
	const secondsPerBeat = 60 / bpm;
	const pixelsPerBeat = secondsPerBeat * pxPerMs * 1000;

	for (let beat = 0; beat * pixelsPerBeat < timelineWidthPx; beat++) {
		const time = beat * secondsPerBeat;
		markers.push({
			beat,
			time: time * 1000,
			position: beat * pixelsPerBeat,
			isMeasure: beat % 4 === 0,
		});
	}

	return markers;
}

/**
 * Calculate time markers for timeline
 */
export function calculateTimeMarkers(
	timelineWidthPx: number,
	pxPerMs: number,
	zoom: number,
): Array<{
	time: number;
	position: number;
	label: string;
}> {
	if (pxPerMs <= 0) return [];
	const markers = [];
	const pixelsPerSecond = pxPerMs * 1000;
	const secondsPerMarker = zoom < 0.5 ? 10 : zoom < 1 ? 5 : 1;

	for (
		let time = 0;
		time * pixelsPerSecond < timelineWidthPx;
		time += secondsPerMarker
	) {
		const timestampMs = time * 1000;
		markers.push({
			time: timestampMs,
			position: time * pixelsPerSecond,
			label: formatDuration(timestampMs),
		});
	}

	return markers;
}

// === Musical timebase conversions ===
export function msToBeats(
	ms: number,
	bpm: number,
	signature?: { num: number; den: number },
): number {
	const seconds = ms / 1000;
	const baseBeats = seconds * (bpm / 60);
	if (!signature) return baseBeats;
	// Adjust for denominator: if den=8, one notated beat is an eighth note.
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
	const tick = Math.floor((beats - Math.floor(beats)) * 960); // PPQ=960
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

	// Triplet: divide each division into 3 equal parts
	let division = baseDivisionBeats;
	if (grid.triplet) division = baseDivisionBeats / 3;

	// Swing: bias every second subdivision toward later time by factor (0–0.6)
	// Implement as post-snap micro-shift
	const snapped = Math.round(beatPos / division) * division;
	const isEven = Math.round(beatPos / division) % 2 === 0;
	if (grid.swing && grid.swing > 0 && !grid.triplet) {
		const swing01 = grid.swing / 100; // Normalize from 0-100 to 0-1
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

// === Bars grid generation ===
export function getDivisionBeats(
	res: "1/1" | "1/2" | "1/4" | "1/8" | "1/16",
	signature: { num: number; den: number },
): number {
	const denom = Number(res.split("/")[1]);
	// One division equals barsPerDivision * beatsPerBar, where beats are notated beats
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

	// Iterate bars until width covered
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

		// Subdivisions within each beat/measure granularity
		const subdivMs = subdivBeats * msPerBeat;
		const divisionsPerBar = beatsPerBar / subdivBeats;
		for (let i = 1; i < divisionsPerBar; i++) {
			const subTime = barStartMs + i * subdivMs;
			let subPx = subTime * pxPerMs;
			if (swing > 0 && !triplet) {
				// Visual bias only on even subdivisions
				const isEven = i % 2 === 0;
				const swing01 = swing / 100; // Normalize from 0-100 to 0-1
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

export function enumerateGrid(
	viewStartMs: number,
	viewEndMs: number,
	bpm: number,
	signature: { num: number; den: number },
	res: "1/1" | "1/2" | "1/4" | "1/8" | "1/16",
	triplet: boolean,
): { measures: number[]; beats: number[]; subs: number[] } {
	const measures: number[] = [];
	const beats: number[] = [];
	const subs: number[] = [];
	const secondsPerBeat = (60 / bpm) * (4 / signature.den);
	const beatsPerBar = signature.num;
	const msPerBeat = secondsPerBeat * 1000;
	const msPerBar = beatsPerBar * msPerBeat;
	const divisionBeats = getDivisionBeats(res, signature);
	const subdivBeats = triplet ? divisionBeats / 3 : divisionBeats;
	const subdivMs = subdivBeats * msPerBeat;

	const startBar = Math.floor(viewStartMs / msPerBar);
	const endBar = Math.ceil(viewEndMs / msPerBar) + 1;

	for (let bar = startBar; bar < endBar; bar++) {
		const barMs = bar * msPerBar;
		if (barMs >= viewStartMs && barMs <= viewEndMs) measures.push(barMs);
		for (let beat = 1; beat < beatsPerBar; beat++) {
			const beatMs = barMs + beat * msPerBeat;
			if (beatMs >= viewStartMs && beatMs <= viewEndMs) beats.push(beatMs);
		}
		const divisionsPerBar = beatsPerBar / subdivBeats;
		for (let i = 1; i < divisionsPerBar; i++) {
			const subMs = barMs + i * subdivMs;
			if (subMs >= viewStartMs && subMs <= viewEndMs) subs.push(subMs);
		}
	}

	return { measures, beats, subs };
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
