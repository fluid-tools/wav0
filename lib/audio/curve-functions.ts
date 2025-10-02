/**
 * Audio Curve Generation for Professional DAW
 *
 * Implements industry-standard curve types for automation and fades:
 * - Linear: Constant rate of change
 * - Exponential (EaseIn): Slow start, accelerating end
 * - Logarithmic (EaseOut): Fast start, decelerating end
 * - S-Curve (Cosine): Smooth acceleration (slow → fast → slow)
 *
 * Each curve supports a shape parameter (0-1) for user control.
 */

export type CurveType = "linear" | "easeIn" | "easeOut" | "sCurve";

/**
 * Generate curve values for Web Audio API
 *
 * @param type - Curve type (linear, easeIn, easeOut, sCurve)
 * @param startValue - Starting value
 * @param endValue - Ending value
 * @param duration - Duration in seconds
 * @param shape - Curve shape parameter (0-1, default 0.5)
 *                0 = gentle, 0.5 = balanced, 1 = steep
 * @param sampleRate - Audio context sample rate (default 48000)
 * @returns Float32Array of curve values for setValueCurveAtTime()
 */
export function generateCurve(
	type: CurveType,
	startValue: number,
	endValue: number,
	duration: number,
	shape = 0.5,
	sampleRate = 48000,
): Float32Array {
	// Minimum 2 samples required by Web Audio API
	const numSamples = Math.max(2, Math.ceil(duration * sampleRate));
	const curve = new Float32Array(numSamples);
	const delta = endValue - startValue;

	// Clamp shape to valid range
	const s = Math.max(0, Math.min(1, shape));

	for (let i = 0; i < numSamples; i++) {
		const t = i / (numSamples - 1); // Normalized time: 0 to 1

		let value: number;
		switch (type) {
			case "linear":
				// Simple linear interpolation
				value = startValue + delta * t;
				break;

			case "easeIn": {
				// Exponential curve: y = t^n where n increases with shape
				// shape = 0 → gentle (n=1, linear)
				// shape = 0.5 → balanced (n=2.5)
				// shape = 1 → steep (n=4)
				const power = 1 + s * 3;
				value = startValue + delta * t ** power;
				break;
			}

			case "easeOut": {
				// Logarithmic curve: y = 1 - (1-t)^n
				// Inverse of easeIn, creates fast start / slow end
				const power = 1 + s * 3;
				value = startValue + delta * (1 - (1 - t) ** power);
				break;
			}

			case "sCurve": {
				// Cosine-based S-curve: smooth acceleration
				// Adjusts frequency to control "tightness" of S
				// shape = 0 → wide gentle S
				// shape = 0.5 → balanced S
				// shape = 1 → tight sharp S
				const freq = 1 + s * 2; // Range: 1 to 3
				const raw = 0.5 - 0.5 * Math.cos(Math.PI * freq * t);

				// Normalize to [0,1] range
				const rangeMax = 0.5 - 0.5 * Math.cos(Math.PI * freq);
				const normalized = raw / rangeMax;

				value = startValue + delta * normalized;
				break;
			}

			default:
				// Fallback to linear
				value = startValue + delta * t;
		}

		curve[i] = value;
	}

	return curve;
}

/**
 * Apply curve to AudioParam using the most appropriate Web Audio method
 *
 * - Linear: Uses native linearRampToValueAtTime (most efficient)
 * - EaseIn: Uses native exponentialRampToValueAtTime (good for fade-ins)
 * - EaseOut/S-Curve: Uses setValueCurveAtTime with custom curve
 *
 * @param param - AudioParam to modify (e.g., gainNode.gain)
 * @param type - Curve type
 * @param startValue - Starting value
 * @param endValue - Ending value
 * @param startTime - Start time in AudioContext time
 * @param duration - Duration in seconds
 * @param shape - Curve shape parameter (0-1)
 * @param audioContext - AudioContext for sample rate and time
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

	// Cancel any scheduled changes after this point
	param.cancelScheduledValues(at);

	// Set initial value
	param.setValueAtTime(startValue, at);

	switch (type) {
		case "linear":
			// Use native linear ramp (most efficient)
			param.linearRampToValueAtTime(endValue, at + duration);
			break;

		case "easeIn": {
			// Use native exponential ramp
			// Web Audio requires positive values for exponential
			const safeStart = Math.max(startValue, 0.0001);
			const safeEnd = Math.max(endValue, 0.0001);

			// If we had to floor values, set them explicitly
			if (startValue !== safeStart) {
				param.setValueAtTime(safeStart, at);
			}

			param.exponentialRampToValueAtTime(safeEnd, at + duration);

			// If end value was actually 0, set it after the ramp
			if (endValue < 0.0001) {
				param.setValueAtTime(0, at + duration);
			}
			break;
		}

		case "easeOut":
		case "sCurve": {
			// Use custom curve via setValueCurveAtTime
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
			// Fallback to linear
			param.linearRampToValueAtTime(endValue, at + duration);
	}
}

/**
 * Calculate intermediate value for a given curve type at time t
 * Useful for UI previews and real-time visualization
 *
 * @param type - Curve type
 * @param t - Normalized time (0-1)
 * @param shape - Curve shape parameter (0-1)
 * @returns Normalized value (0-1)
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
