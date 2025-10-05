import type { Track, TrackEnvelopePoint } from "../types/schemas";

/**
 * Count automation points within time range
 */
export function countAutomationPointsInRange(
	track: Track,
	startTime: number,
	endTime: number,
): number {
	const envelope = track.volumeEnvelope;
	if (!envelope || !envelope.enabled || !envelope.points) {
		return 0;
	}

	return envelope.points.filter(
		(point) => point.time >= startTime && point.time <= endTime,
	).length;
}

/**
 * Get automation points within time range
 */
export function getAutomationPointsInRange(
	track: Track,
	startTime: number,
	endTime: number,
): TrackEnvelopePoint[] {
	const envelope = track.volumeEnvelope;
	if (!envelope || !envelope.enabled || !envelope.points) {
		return [];
	}

	return envelope.points.filter(
		(point) => point.time >= startTime && point.time <= endTime,
	);
}

/**
 * Transfer automation points from source to destination track
 */
export function transferAutomationPoints(
	sourceTrack: Track,
	_destTrack: Track,
	clipStartTime: number,
	clipEndTime: number,
	newStartTime: number,
): TrackEnvelopePoint[] {
	const points = getAutomationPointsInRange(
		sourceTrack,
		clipStartTime,
		clipEndTime,
	);

	if (points.length === 0) {
		return [];
	}

	const offset = newStartTime - clipStartTime;

	return points.map((point) => ({
		...point,
		time: point.time + offset,
	}));
}

/**
 * Remove automation points within time range
 */
export function removeAutomationPointsInRange(
	track: Track,
	startTime: number,
	endTime: number,
): Track {
	const envelope = track.volumeEnvelope;
	if (!envelope || !envelope.enabled || !envelope.points) {
		return track;
	}

	return {
		...track,
		volumeEnvelope: {
			...envelope,
			points: envelope.points.filter(
				(point) => point.time < startTime || point.time > endTime,
			),
		},
	};
}

/**
 * Get envelope multiplier at specific time with interpolation
 */
export function getEnvelopeMultiplierAtTime(
	points: TrackEnvelopePoint[],
	timeMs: number,
): number {
	if (points.length === 0) return 1.0;

	const sorted = [...points].sort((a, b) => a.time - b.time);

	if (timeMs <= sorted[0].time) {
		return sorted[0].value;
	}

	if (timeMs >= sorted[sorted.length - 1].time) {
		return sorted[sorted.length - 1].value;
	}

	for (let i = 0; i < sorted.length - 1; i++) {
		const p1 = sorted[i];
		const p2 = sorted[i + 1];

		if (timeMs >= p1.time && timeMs <= p2.time) {
			const progress = (timeMs - p1.time) / (p2.time - p1.time);
			return interpolateValue(p1.value, p2.value, progress, p2.curve);
		}
	}

	return 1.0;
}

/**
 * Interpolate between two values based on curve type
 */
function interpolateValue(
	start: number,
	end: number,
	progress: number,
	curve: TrackEnvelopePoint["curve"],
): number {
	switch (curve) {
		case "easeIn":
			return start + (end - start) * progress * progress;
		case "easeOut":
			return start + (end - start) * (1 - (1 - progress) * (1 - progress));
		case "sCurve": {
			const t =
				progress < 0.5
					? 2 * progress * progress
					: 1 - 2 * (1 - progress) * (1 - progress);
			return start + (end - start) * t;
		}
		default:
			return start + (end - start) * progress;
	}
}
