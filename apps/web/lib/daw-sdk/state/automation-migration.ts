/**
 * Automation Migration Helper
 * Only used for migrating old envelope format to new segment-based format
 * Can be deleted once migration is complete
 */

import type {
	TrackEnvelope,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
} from "../types/schemas";

export function migrateAutomationToSegments(
	envelope: TrackEnvelope,
): TrackEnvelope {
	// Check if already migrated (has segments)
	if (envelope.segments && envelope.segments.length > 0) {
		return envelope; // Already migrated
	}

	// Old envelope point format with curve/curveShape on points
	type LegacyEnvelopePoint = TrackEnvelopePoint & {
		curve?: string;
		curveShape?: number;
	};

	// Check if old format (points with curve/curveShape)
	const hasOldFormat = envelope.points.some(
		(p): p is LegacyEnvelopePoint => "curve" in p || "curveShape" in p,
	);

	if (!hasOldFormat) {
		// New format but no segments yet - generate default linear segments
		const segments: TrackEnvelopeSegment[] = [];
		for (let i = 0; i < envelope.points.length - 1; i++) {
			segments.push({
				id: crypto.randomUUID(),
				fromPointId: envelope.points[i].id,
				toPointId: envelope.points[i + 1].id,
				curve: 0, // Linear
			});
		}
		return { ...envelope, segments };
	}

	// Migrate from old format
	const cleanedPoints: TrackEnvelopePoint[] = envelope.points.map((p) => {
		const { curve, curveShape, ...rest } = p as LegacyEnvelopePoint;
		return rest;
	});

	const segments: TrackEnvelopeSegment[] = [];
	for (let i = 0; i < cleanedPoints.length - 1; i++) {
		const p = envelope.points[i] as LegacyEnvelopePoint;
		const nextP = cleanedPoints[i + 1];

		// Convert old curveShape to new curve value (-99 to +99)
		let curveValue = 0; // default linear
		if (typeof p.curveShape === "number") {
			// Old curveShape was 0-1, map to -99 to +99
			curveValue = (p.curveShape - 0.5) * 2 * 99;
		}

		segments.push({
			id: crypto.randomUUID(),
			fromPointId: cleanedPoints[i].id,
			toPointId: nextP.id,
			curve: curveValue,
		});
	}

	return { ...envelope, points: cleanedPoints, segments };
}
