import type { Track, TrackEnvelopePoint } from "@/lib/daw-sdk";

/**
 * Count automation points within a given time range
 * Used to determine if automation transfer dialog should be shown
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
 * Get automation points within a given time range
 * Returns points that fall within [startTime, endTime]
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
 * Transfer automation points from source track to destination track
 * Adjusts point times based on clip's new start position
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

	// Calculate time offset
	const offset = newStartTime - clipStartTime;

	// Create new points with adjusted times
	return points.map((point) => ({
		...point,
		time: point.time + offset,
	}));
}

/**
 * Remove automation points within a given time range from a track
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
