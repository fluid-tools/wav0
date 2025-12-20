/**
 * Looping Policy Utilities
 *
 * Defines policies for automatic loop end calculation based on clip duration.
 */

export interface LoopingPolicy {
	/** Clips shorter than this (ms) get more repetitions */
	shortClipMsThreshold: number;
	/** Default minimum repetitions for long clips */
	minRepetitionsDefault: number;
	/** Minimum repetitions for short clips */
	minRepetitionsForShortClips: number;
}

/**
 * Default looping policy
 * - Short clips (< 15s) loop at least 4 times
 * - Long clips loop at least 1 time (plays twice total)
 */
export const DEFAULT_LOOPING_POLICY: LoopingPolicy = {
	shortClipMsThreshold: 15_000,
	minRepetitionsDefault: 1,
	minRepetitionsForShortClips: 4,
};

/**
 * Compute the automatic loop end time for a clip
 *
 * @param clip - Clip with timing info (startTime, trimStart, trimEnd in ms)
 * @param policy - Looping policy to use (defaults to DEFAULT_LOOPING_POLICY)
 * @returns Loop end time in ms
 */
export function computeLoopEndMs(
	clip: { startTime: number; trimStart: number; trimEnd: number },
	policy: LoopingPolicy = DEFAULT_LOOPING_POLICY,
): number {
	const duration = Math.max(0, clip.trimEnd - clip.trimStart);
	if (duration <= 0) return clip.startTime;
	const minReps =
		duration < policy.shortClipMsThreshold
			? policy.minRepetitionsForShortClips
			: policy.minRepetitionsDefault;
	return clip.startTime + duration * (minReps + 1);
}
