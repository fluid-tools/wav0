/**
 * Audio scheduling precision constants
 *
 * These constants define timing tolerances and thresholds for Web Audio API scheduling,
 * particularly for automation curves via setValueCurveAtTime. They prevent API errors
 * from overlapping schedules while maintaining audio precision.
 */

/**
 * Time window (in seconds) to look back when canceling scheduled automation values.
 *
 * Used to catch automation curves that started very recently during rapid reschedules
 * (e.g., rapid mute/solo toggles). 10ms provides a safety margin while being small
 * enough to not affect playback.
 *
 * @example
 * ```ts
 * const cancelFrom = Math.max(0, now - AUTOMATION_CANCEL_LOOKAHEAD_SEC);
 * envelopeGain.gain.cancelScheduledValues(cancelFrom);
 * ```
 */
export const AUTOMATION_CANCEL_LOOKAHEAD_SEC = 0.01;

/**
 * Minimum gap (in seconds) between scheduled automation segments.
 *
 * Ensures setValueCurveAtTime calls don't overlap, which would cause a
 * NotSupportedError. 1ms is the minimum practical duration that prevents
 * rounding errors and API errors while maintaining precision.
 *
 * @example
 * ```ts
 * if (adjustedStart < lastScheduledEnd + AUTOMATION_SCHEDULING_EPSILON_SEC) {
 *   adjustedStart = lastScheduledEnd + AUTOMATION_SCHEDULING_EPSILON_SEC;
 * }
 * ```
 */
export const AUTOMATION_SCHEDULING_EPSILON_SEC = 0.001;

/**
 * Minimum valid duration (in seconds) for automation segments.
 *
 * Web Audio API requires non-zero durations for setValueCurveAtTime.
 * Segments shorter than this threshold are skipped as they cannot be
 * scheduled reliably and would cause API errors.
 *
 * @example
 * ```ts
 * const segDur = Math.max(MIN_AUTOMATION_SEGMENT_DURATION_SEC, (b.time - a.time) / 1000);
 * ```
 */
export const MIN_AUTOMATION_SEGMENT_DURATION_SEC = 0.001;

