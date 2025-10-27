/**
 * Time grid generation utilities
 * Pure functions for generating adaptive time-based grids based on zoom level
 */

export type TimeMarker = {
	ms: number;
	label: string;
};

export type TimeSteps = {
	majorMs: number;
	minorMs: number;
	labelFormat: "ss.ms" | "mm:ss";
};

/**
 * Choose adaptive time steps based on pixels per millisecond
 * Target: major lines spaced ~80-140px apart
 */
export function chooseTimeSteps(pxPerMs: number): TimeSteps {
	const candidateSteps = [
		100, // 0.1s
		200, // 0.2s
		500, // 0.5s
		1000, // 1s
		2000, // 2s
		5000, // 5s
		10000, // 10s
		15000, // 15s
		30000, // 30s
		60000, // 60s
	];

	// Find smallest step that yields >= 80px spacing
	let majorMs = candidateSteps[candidateSteps.length - 1]; // fallback to largest
	for (const step of candidateSteps) {
		if (step * pxPerMs >= 80) {
			majorMs = step;
			break;
		}
	}

	// Minor ticks are major/5, rounded to nearest 10ms, clamped >= 50ms
	const minorMs = Math.max(50, Math.round(majorMs / 5 / 10) * 10);

	// Label format: use mm:ss for >= 1s, ss.ms for < 1s
	const labelFormat = majorMs >= 1000 ? "mm:ss" : "ss.ms";

	return { majorMs, minorMs, labelFormat };
}

/**
 * Format time for display based on format type
 */
export function formatTimeMs(ms: number, format: "ss.ms" | "mm:ss"): string {
	if (format === "mm:ss") {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

	// ss.ms format
	const seconds = Math.floor(ms / 1000);
	const msRemainder = Math.floor((ms % 1000) / 100);
	return `${seconds}.${msRemainder}`;
}

export type TimeGrid = {
	majors: TimeMarker[];
	minors: number[];
};

/**
 * Generate time grid markers for a given viewport
 * Pure function - deterministic output for given inputs
 */
export function generateTimeGrid(params: {
	viewStartMs: number;
	viewEndMs: number;
	pxPerMs: number;
}): TimeGrid {
	const { viewStartMs, viewEndMs, pxPerMs } = params;

	if (pxPerMs <= 0 || viewEndMs <= viewStartMs) {
		return { majors: [], minors: [] };
	}

	const { majorMs, minorMs, labelFormat } = chooseTimeSteps(pxPerMs);

	const majors: TimeMarker[] = [];
	const minors: number[] = [];

	// Generate major markers
	// Start from the first major mark before or at viewStart
	const firstMajor = Math.floor(viewStartMs / majorMs) * majorMs;
	for (let ms = firstMajor; ms <= viewEndMs; ms += majorMs) {
		if (ms >= viewStartMs) {
			majors.push({
				ms,
				label: formatTimeMs(ms, labelFormat),
			});
		}
	}

	// Generate minor markers (in gaps between majors)
	for (let ms = firstMajor; ms <= viewEndMs; ms += minorMs) {
		// Skip if this would land exactly on a major mark
		if (ms % majorMs === 0) continue;
		if (ms >= viewStartMs) {
			minors.push(ms);
		}
	}

	return { majors, minors };
}

