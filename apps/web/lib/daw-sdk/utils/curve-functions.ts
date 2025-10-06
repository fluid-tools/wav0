import type { CurveType } from "../types/schemas";

/**
 * Calculate intermediate value for a given curve type at time t
 * Used for envelope automation and UI previews
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
