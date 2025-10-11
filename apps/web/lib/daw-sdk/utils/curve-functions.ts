import type { CurveType } from "../types/schemas";

/**
 * NEW: Evaluate curve between two values using -99 to +99 curve parameter (Logic Pro style)
 * @param start Starting value
 * @param end Ending value
 * @param t Progress 0-1
 * @param curve Curve amount: -99 to +99 (0 = linear, negative = exponential, positive = logarithmic)
 */
export function evaluateSegmentCurve(
	start: number,
	end: number,
	t: number,
	curve: number,
): number {
	const clamped = Math.max(0, Math.min(1, t));

	if (curve === 0) {
		// Linear
		return start + (end - start) * clamped;
	}

	// Normalize curve to 0-1 range
	const normalized = Math.abs(curve) / 99;

	let adjusted: number;
	if (curve < 0) {
		// Negative = Exponential (fast start, slow end)
		const power = 1 + normalized * 3;
		adjusted = clamped ** power;
	} else {
		// Positive = Logarithmic (slow start, fast end)
		const power = 1 + normalized * 3;
		adjusted = 1 - (1 - clamped) ** power;
	}

	return start + (end - start) * adjusted;
}

/**
 * Calculate intermediate value for a given curve type at time t
 * Used for envelope automation and UI previews
 *
 * @deprecated Use evaluateSegmentCurve with -99 to +99 curve parameter instead
 *
 * @param type - Curve type (linear, easeIn, easeOut, sCurve)
 * @param t - Time progress from 0.0 to 1.0
 * @param shape - Curve intensity from 0.0 (gentle) to 1.0 (steep)
 */
export function evaluateCurve(type: CurveType, t: number, shape = 0.5): number {
	const s = Math.max(0, Math.min(1, shape));
	const clamped = Math.max(0, Math.min(1, t));

	switch (type) {
		case "linear":
			return clamped;

		case "easeIn": {
			const power = 1 + s * 3;
			return clamped ** power;
		}

		case "easeOut": {
			const power = 1 + s * 3;
			return 1 - (1 - clamped) ** power;
		}

		case "sCurve": {
			const freq = 1 + s * 2;
			const raw = 0.5 - 0.5 * Math.cos(Math.PI * freq * clamped);
			const rangeMax = 0.5 - 0.5 * Math.cos(Math.PI * freq);
			return raw / rangeMax;
		}

		default:
			return clamped;
	}
}

/**
 * Generate curve values for Web Audio API
 */
export function generateCurve(
	type: CurveType,
	startValue: number,
	endValue: number,
	duration: number,
	shape = 0.5,
	sampleRate = 48000,
): Float32Array {
	const numSamples = Math.max(2, Math.ceil(duration * sampleRate));
	const curve = new Float32Array(numSamples);
	const delta = endValue - startValue;
	const s = Math.max(0, Math.min(1, shape));

	for (let i = 0; i < numSamples; i++) {
		const t = i / (numSamples - 1);
		const value = startValue + delta * evaluateCurve(type, t, s);
		curve[i] = value;
	}

	return curve;
}

/**
 * Apply curve to AudioParam
 */
export function applyCurveToParam(
	param: AudioParam,
	type: CurveType,
	startValue: number,
	endValue: number,
	startTime: number,
	duration: number,
	shape: number,
	audioContext: AudioContext,
): void {
	const now = audioContext.currentTime;
	const at = Math.max(startTime, now);

	param.cancelScheduledValues(at);
	param.setValueAtTime(startValue, at);

	switch (type) {
		case "linear":
			param.linearRampToValueAtTime(endValue, at + duration);
			break;

		case "easeIn": {
			const safeStart = Math.max(startValue, 0.0001);
			const safeEnd = Math.max(endValue, 0.0001);

			if (startValue !== safeStart) {
				param.setValueAtTime(safeStart, at);
			}

			param.exponentialRampToValueAtTime(safeEnd, at + duration);

			if (endValue < 0.0001) {
				param.setValueAtTime(0, at + duration);
			}
			break;
		}

		case "easeOut":
		case "sCurve": {
			const curve = generateCurve(
				type,
				startValue,
				endValue,
				duration,
				shape,
				audioContext.sampleRate,
			);
			param.setValueCurveAtTime(curve, at, duration);
			break;
		}

		default:
			param.linearRampToValueAtTime(endValue, at + duration);
	}
}

/**
 * Get human-readable label for curve type
 */
export function getCurveLabel(type: CurveType): string {
	switch (type) {
		case "linear":
			return "Linear";
		case "easeIn":
			return "Exponential";
		case "easeOut":
			return "Logarithmic";
		case "sCurve":
			return "S-Curve";
		default:
			return "Unknown";
	}
}

/**
 * Get description for curve type
 * @deprecated Use getSegmentCurveDescription with -99 to +99 curve parameter
 */
export function getCurveDescription(type: CurveType): string {
	switch (type) {
		case "linear":
			return "Constant rate of change";
		case "easeIn":
			return "Slow start, accelerating end";
		case "easeOut":
			return "Fast start, decelerating end (natural fade-out)";
		case "sCurve":
			return "Smooth acceleration (slow → fast → slow)";
		default:
			return "";
	}
}

/**
 * Get description for segment curve (-99 to +99)
 */
export function getSegmentCurveDescription(curve: number): string {
	if (curve === 0) return "Linear";
	if (curve < 0)
		return `Exponential (${Math.abs(curve)}) - Fast start, slow end`;
	return `Logarithmic (${curve}) - Slow start, fast end`;
}
