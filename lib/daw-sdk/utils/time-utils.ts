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
