export interface LoopingPolicy {
	shortClipMsThreshold: number;
	minRepetitionsDefault: number;
	minRepetitionsForShortClips: number;
}

export const loopingPolicy: LoopingPolicy = {
	shortClipMsThreshold: 15_000,
	minRepetitionsDefault: 1,
	minRepetitionsForShortClips: 4,
};

export function computeLoopEndMs(
	clip: { startTime: number; trimStart: number; trimEnd: number },
	policy: LoopingPolicy = loopingPolicy,
): number {
	const duration = Math.max(0, clip.trimEnd - clip.trimStart);
	if (duration <= 0) return clip.startTime;
	const minReps =
		duration < policy.shortClipMsThreshold
			? policy.minRepetitionsForShortClips
			: policy.minRepetitionsDefault;
	return clip.startTime + duration * (minReps + 1);
}
