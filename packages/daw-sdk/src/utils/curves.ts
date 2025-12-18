/**
 * Curve evaluation utilities for automation and envelopes
 * Logic Pro style -99 to +99 curve system
 */

export namespace curves {
	/**
	 * Apply curve transformation to a normalized progress value (0-1)
	 * @param t Progress 0-1
	 * @param curve Curve amount: -99 to +99 (0 = linear, negative = exponential, positive = logarithmic)
	 * @returns Curved progress value (0-1)
	 */
	export function applyCurvedT(t: number, curve: number): number {
		if (curve === 0) return t;

		const power = 1 + (Math.abs(curve) / 99) * 3;
		return curve < 0 ? t ** power : 1 - (1 - t) ** power;
	}

	/**
	 * Evaluate curve between two values using -99 to +99 curve parameter
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
		const curvedT = applyCurvedT(clamped, curve);
		return start + (end - start) * curvedT;
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

	/**
	 * Generate curve values for Web Audio API
	 */
	export function generateAudioCurve(
		startValue: number,
		endValue: number,
		curve: number,
		duration: number,
		sampleRate = 48000,
	): Float32Array {
		const numSamples = Math.max(2, Math.ceil(duration * sampleRate));
		const curveArray = new Float32Array(numSamples);

		for (let i = 0; i < numSamples; i++) {
			const t = i / (numSamples - 1);
			curveArray[i] = evaluateSegmentCurve(startValue, endValue, t, curve);
		}

		return curveArray;
	}

	/**
	 * Apply curve to AudioParam
	 */
	export function applyCurveToParam(
		param: AudioParam,
		startValue: number,
		endValue: number,
		startTime: number,
		duration: number,
		curve: number,
		audioContext: AudioContext,
	): void {
		const now = audioContext.currentTime;
		const at = Math.max(startTime, now);

		param.cancelScheduledValues(at);
		param.setValueAtTime(startValue, at);

		if (curve === 0) {
			// Linear
			param.linearRampToValueAtTime(endValue, at + duration);
		} else if (curve < 0) {
			// Exponential - use exponentialRampToValueAtTime when possible
			const safeStart = Math.max(startValue, 0.0001);
			const safeEnd = Math.max(endValue, 0.0001);

			if (startValue !== safeStart) {
				param.setValueAtTime(safeStart, at);
			}

			param.exponentialRampToValueAtTime(safeEnd, at + duration);

			if (endValue < 0.0001) {
				param.setValueAtTime(0, at + duration);
			}
		} else {
			// Logarithmic or custom curve - use setValueCurveAtTime
			const curveArray = generateAudioCurve(
				startValue,
				endValue,
				curve,
				duration,
				audioContext.sampleRate,
			);
			param.setValueCurveAtTime(curveArray, at, duration);
		}
	}
}
