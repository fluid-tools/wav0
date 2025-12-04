/**
 * Envelope helper utilities
 * Shared functions for envelope manipulation
 */

import type { Clip, TrackEnvelope, TrackEnvelopePoint } from "@wav0/daw-sdk";

/**
 * Bind envelope points to clips based on their time position
 * Points that fall within a clip's time range are bound to that clip
 */
export function bindEnvelopeToClips(
	envelope: TrackEnvelope,
	clips?: Clip[],
): TrackEnvelope {
	if (!clips || clips.length === 0) return envelope;

	const newPoints = envelope.points.map((point: TrackEnvelopePoint) => {
		// If point already has clipId, keep it
		if (point.clipId) return point;

		// Try to find a clip that contains this point's time
		for (const clip of clips) {
			const clipEnd = clip.startTime + clip.sourceDurationMs;
			if (point.time >= clip.startTime && point.time <= clipEnd) {
				return {
					...point,
					clipId: clip.id,
					clipRelativeTime: point.time - clip.startTime,
				};
			}
		}
		return point;
	});

	return { ...envelope, points: newPoints };
}


