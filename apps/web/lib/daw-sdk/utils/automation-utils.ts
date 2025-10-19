import type {
	Clip,
	CurveType,
	Track,
	TrackEnvelope,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
} from "../types/schemas";
import { evaluateSegmentCurve } from "./curve-functions";

/**
 * Convert absolute automation point to clip-relative
 */
export function makePointClipRelative(
	point: TrackEnvelopePoint,
	clipId: string,
	clipStartTime: number,
): TrackEnvelopePoint {
	return {
		...point,
		clipId,
		clipRelativeTime: point.time - clipStartTime,
	};
}

/**
 * Convert clip-relative point back to absolute time
 */
export function resolveClipRelativePoint(
	point: TrackEnvelopePoint,
	clip: Clip | undefined,
): number {
	if (!point.clipId || !clip) return point.time;
	return clip.startTime + (point.clipRelativeTime ?? 0);
}

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
 * Transfer automation envelope (points + segments) from source to dest track
 * Preserves curve data by transferring segments alongside points
 */
export function transferAutomationEnvelope(
	sourceTrack: Track,
	_destTrack: Track,
	clipStartTime: number,
	clipEndTime: number,
	newStartTime: number,
	targetClipId?: string,
): {
	pointsToTransfer: TrackEnvelopePoint[];
	segmentsToTransfer: TrackEnvelopeSegment[];
} {
	// Get points in range
	const points = getAutomationPointsInRange(
		sourceTrack,
		clipStartTime,
		clipEndTime,
	);

	if (points.length === 0) {
		return { pointsToTransfer: [], segmentsToTransfer: [] };
	}

	const pointIds = points.map((p) => p.id);
	const offset = newStartTime - clipStartTime;

	// Map old point IDs to new point IDs
	const idMap = new Map<string, string>();
	const transferredPoints = points.map((point) => {
		const newId = crypto.randomUUID();
		idMap.set(point.id, newId);

		const newPoint: TrackEnvelopePoint = {
			...point,
			id: newId,
			time: point.time + offset,
		};

		// If target clip ID provided, bind the point to the clip
		if (targetClipId) {
			newPoint.clipId = targetClipId;
			newPoint.clipRelativeTime = point.time - clipStartTime;
		}

		return newPoint;
	});

	// Find segments connecting the transferred points
	const envelope = sourceTrack.volumeEnvelope;
	if (!envelope?.segments) {
		return { pointsToTransfer: transferredPoints, segmentsToTransfer: [] };
	}

	// Transfer segments that connect points within the range
	const transferredSegments: TrackEnvelopeSegment[] = envelope.segments
		.filter(
			(seg) =>
				pointIds.includes(seg.fromPointId) && pointIds.includes(seg.toPointId),
		)
		.map((seg) => {
			const fromId = idMap.get(seg.fromPointId);
			const toId = idMap.get(seg.toPointId);
			if (!fromId || !toId) {
				throw new Error("Invalid segment point ID mapping");
			}
			return {
				id: crypto.randomUUID(),
				fromPointId: fromId,
				toPointId: toId,
				curve: seg.curve,
			};
		});

	return {
		pointsToTransfer: transferredPoints,
		segmentsToTransfer: transferredSegments,
	};
}

/**
 * @deprecated Use transferAutomationEnvelope instead
 */
export function transferAutomationPoints(
	sourceTrack: Track,
	destTrack: Track,
	clipStartTime: number,
	clipEndTime: number,
	newStartTime: number,
	targetClipId?: string,
): TrackEnvelopePoint[] {
	const { pointsToTransfer } = transferAutomationEnvelope(
		sourceTrack,
		destTrack,
		clipStartTime,
		clipEndTime,
		newStartTime,
		targetClipId,
	);
	return pointsToTransfer;
}

/**
 * Remove automation points AND their segments within time range (Track-based)
 * @deprecated Use envelope-based removeAutomationPointsInRange instead
 */
export function removeAutomationPointsInRangeTrack(
	track: Track,
	startTime: number,
	endTime: number,
): Track {
	const envelope = track.volumeEnvelope;
	if (!envelope || !envelope.enabled || !envelope.points) {
		return track;
	}

	const updatedEnvelope = removeEnvelopeAutomationPointsInRange(
		envelope,
		startTime,
		endTime,
	);

	return {
		...track,
		volumeEnvelope: updatedEnvelope,
	};
}

/**
 * Get envelope multiplier at specific time with interpolation
 * Uses segment-based curves (Logic Pro style)
 */
export function getEnvelopeMultiplierAtTime(
	envelope: TrackEnvelope,
	timeMs: number,
): number {
	if (envelope.points.length === 0) return 1.0;

	const sorted = [...envelope.points].sort((a, b) => a.time - b.time);

	if (timeMs <= sorted[0].time) {
		return sorted[0].value;
	}

	if (timeMs >= sorted[sorted.length - 1].time) {
		return sorted[sorted.length - 1].value;
	}

	// Find segment containing timeMs
	for (let i = 0; i < sorted.length - 1; i++) {
		const p1 = sorted[i];
		const p2 = sorted[i + 1];

		if (timeMs >= p1.time && timeMs <= p2.time) {
			const progress = (timeMs - p1.time) / (p2.time - p1.time);

			// Find segment for this point pair
			const segment = envelope.segments?.find(
				(s) => s.fromPointId === p1.id && s.toPointId === p2.id,
			);

			const curve = segment?.curve ?? 0;

			// Use new curve evaluation
			return evaluateSegmentCurve(p1.value, p2.value, progress, curve);
		}
	}

	return 1.0;
}

/**
 * Evaluate envelope gain multiplier at a given absolute timeline time
 * Safe for undefined/disabled envelopes. Returns 1.0 when not applicable.
 */
export function evaluateEnvelopeGainAt(
	envelope: TrackEnvelope | undefined,
	timeMs: number,
): number {
	if (!envelope || !envelope.enabled || !envelope.points?.length) return 1.0;
	return getEnvelopeMultiplierAtTime(envelope, timeMs);
}

/**
 * Interpolate between two values based on curve value (-99 to +99)
 * @deprecated Use evaluateSegmentCurve with -99 to +99 curve parameter instead
 */
function _interpolateValue(
	start: number,
	end: number,
	progress: number,
	curve: number,
): number {
	if (curve === 0) {
		// Linear
		return start + (end - start) * progress;
	}

	// Apply curve transformation
	let curvedProgress: number;
	if (curve < 0) {
		// Negative = Exponential (fast start, slow end)
		const power = 1 + (Math.abs(curve) / 99) * 3;
		curvedProgress = progress ** power;
	} else {
		// Positive = Logarithmic (slow start, fast end)
		const power = 1 + (curve / 99) * 3;
		curvedProgress = 1 - (1 - progress) ** power;
	}

	return start + (end - start) * curvedProgress;
}

/**
 * Migration: Convert old curve type + shape to new -99 to +99 system
 */
function convertOldCurveToNew(type: CurveType, shape: number): number {
	// shape 0.5 = balanced, <0.5 = more gentle, >0.5 = more extreme
	const intensity = (shape - 0.5) * 2 * 99; // Map to -99 to +99

	switch (type) {
		case "linear":
			return 0;
		case "easeIn":
			return -intensity; // Exponential (fast start)
		case "easeOut":
			return intensity; // Logarithmic (slow start)
		case "sCurve":
			return intensity; // S-curve uses positive curve
		default:
			return 0;
	}
}

/**
 * Migration: Convert old point-based automation to new segment-based system
 * Detects old format and auto-migrates to new format
 */
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
		return generateSegmentsFromPoints(envelope);
	}

	// Migrate old format
	const legacyPoints = envelope.points as LegacyEnvelopePoint[];
	const points: TrackEnvelopePoint[] = legacyPoints.map((p) => ({
		id: p.id,
		time: p.time,
		value: p.value,
		clipId: p.clipId,
		clipRelativeTime: p.clipRelativeTime,
		// Remove curve and curveShape
	}));

	// Generate segments from old point curves
	const segments: TrackEnvelopeSegment[] = [];
	for (let i = 0; i < legacyPoints.length - 1; i++) {
		const fromPoint = legacyPoints[i];
		const toPoint = legacyPoints[i + 1];

		const curveType = (fromPoint.curve ?? "linear") as CurveType;
		const curve = convertOldCurveToNew(curveType, fromPoint.curveShape ?? 0.5);

		segments.push({
			id: crypto.randomUUID(),
			fromPointId: fromPoint.id,
			toPointId: toPoint.id,
			curve,
		});
	}


	return {
		enabled: envelope.enabled,
		points,
		segments,
	};
}

/**
 * Generate default linear segments between points (for new envelopes)
 */
export function generateSegmentsFromPoints(
	envelope: TrackEnvelope,
): TrackEnvelope {
	const sortedPoints = [...envelope.points].sort((a, b) => a.time - b.time);
	const segments: TrackEnvelopeSegment[] = [];

	for (let i = 0; i < sortedPoints.length - 1; i++) {
		segments.push({
			id: crypto.randomUUID(),
			fromPointId: sortedPoints[i].id,
			toPointId: sortedPoints[i + 1].id,
			curve: 0, // Default linear
		});
	}

	return {
		...envelope,
		segments,
	};
}

/**
 * Add automation point and auto-generate/update segments
 */
export function addAutomationPoint(
	envelope: TrackEnvelope,
	newPoint: TrackEnvelopePoint,
): TrackEnvelope {
	const sortedPoints = [...envelope.points, newPoint].sort(
		(a, b) => a.time - b.time,
	);
	const newIndex = sortedPoints.findIndex((p) => p.id === newPoint.id);

	const newSegments = [...(envelope.segments || [])];

	if (newIndex > 0) {
		const prevPoint = sortedPoints[newIndex - 1];

		// Remove old segment that this point splits
		if (newIndex < sortedPoints.length - 1) {
			const nextPoint = sortedPoints[newIndex + 1];
			const oldSegmentIndex = newSegments.findIndex(
				(s) => s.fromPointId === prevPoint.id && s.toPointId === nextPoint.id,
			);

			if (oldSegmentIndex >= 0) {
				const oldSegment = newSegments[oldSegmentIndex];
				newSegments.splice(oldSegmentIndex, 1);

				// Create two new segments inheriting old curve
				newSegments.push({
					id: crypto.randomUUID(),
					fromPointId: prevPoint.id,
					toPointId: newPoint.id,
					curve: oldSegment.curve,
				});
				newSegments.push({
					id: crypto.randomUUID(),
					fromPointId: newPoint.id,
					toPointId: nextPoint.id,
					curve: oldSegment.curve,
				});
			} else {
				// No existing segment, create new linear segments
				newSegments.push({
					id: crypto.randomUUID(),
					fromPointId: prevPoint.id,
					toPointId: newPoint.id,
					curve: 0,
				});
				newSegments.push({
					id: crypto.randomUUID(),
					fromPointId: newPoint.id,
					toPointId: nextPoint.id,
					curve: 0,
				});
			}
		} else {
			// New point at end
			newSegments.push({
				id: crypto.randomUUID(),
				fromPointId: prevPoint.id,
				toPointId: newPoint.id,
				curve: 0,
			});
		}
	}

	return {
		...envelope,
		points: sortedPoints,
		segments: newSegments,
	};
}

/**
 * Shift automation points in a time range by a delta (for same-track clip moves)
 * @deprecated Use envelope-based shiftAutomationInRange instead
 */
export function shiftAutomationInRangeTrack(
	track: Track,
	startTime: number,
	endTime: number,
	deltaMs: number,
): Track {
	const envelope = track.volumeEnvelope;
	if (!envelope || !envelope.enabled || !envelope.points) {
		return track;
	}

	const updatedEnvelope = shiftEnvelopeAutomationInRange(
		envelope,
		startTime,
		endTime,
		deltaMs,
	);

	return {
		...track,
		volumeEnvelope: updatedEnvelope,
	};
}

/**
 * Remove automation point and clean up segments
 */
export function removeAutomationPoint(
	envelope: TrackEnvelope,
	pointId: string,
): TrackEnvelope {
	const pointIndex = envelope.points.findIndex((p) => p.id === pointId);
	if (pointIndex === -1) return envelope;

	const sortedPoints = [...envelope.points].sort((a, b) => a.time - b.time);
	const sortedIndex = sortedPoints.findIndex((p) => p.id === pointId);

	// Remove segments connected to this point
	const newSegments = (envelope.segments || []).filter(
		(s) => s.fromPointId !== pointId && s.toPointId !== pointId,
	);

	// If point is in the middle, create new segment connecting neighbors
	if (sortedIndex > 0 && sortedIndex < sortedPoints.length - 1) {
		const prevPoint = sortedPoints[sortedIndex - 1];
		const nextPoint = sortedPoints[sortedIndex + 1];

		// Find average curve from removed segments
		const prevSegment = envelope.segments?.find((s) => s.toPointId === pointId);
		const nextSegment = envelope.segments?.find(
			(s) => s.fromPointId === pointId,
		);
		const avgCurve =
			prevSegment && nextSegment
				? Math.round((prevSegment.curve + nextSegment.curve) / 2)
				: (prevSegment?.curve ?? nextSegment?.curve ?? 0);

		newSegments.push({
			id: crypto.randomUUID(),
			fromPointId: prevPoint.id,
			toPointId: nextPoint.id,
			curve: avgCurve,
		});
	}

	return {
		...envelope,
		points: envelope.points.filter((p) => p.id !== pointId),
		segments: newSegments,
	};
}

/**
 * Update segment curve
 */
export function updateSegmentCurve(
	envelope: TrackEnvelope,
	segmentId: string,
	curve: number,
): TrackEnvelope {
	return {
		...envelope,
		segments: (envelope.segments || []).map((s) =>
			s.id === segmentId
				? { ...s, curve: Math.max(-99, Math.min(99, curve)) }
				: s,
		),
	};
}

/**
 * Rebuild envelope to enforce adjacency invariant
 *
 * Enforces all automation invariants:
 * - Sorts points ascending by time
 * - Clamps time ≥ 0
 * - Dedupes point IDs (keeps first occurrence)
 * - Rebuilds segments to only exist between consecutive points (at most one edge per adjacent pair)
 * - Dedupes segments
 * - Preserves segment curve values where possible
 *
 * Use this after any manual envelope mutation to ensure correctness.
 */
export function rebuildAdjacencyEnvelope(
	envelope: TrackEnvelope,
): TrackEnvelope {
	// Sort points and clamp time
	const sortedPoints = [...envelope.points]
		.map((p) => ({ ...p, time: Math.max(0, p.time) }))
		.sort((a, b) => a.time - b.time);

	// Dedupe by ID (keep first occurrence)
	const seenIds = new Set<string>();
	const uniquePoints = sortedPoints.filter((p) => {
		if (seenIds.has(p.id)) return false;
		seenIds.add(p.id);
		return true;
	});

	// Build adjacency map from old segments to preserve curves
	const curveMap = new Map<string, number>();
	for (const seg of envelope.segments || []) {
		const key = `${seg.fromPointId}-${seg.toPointId}`;
		curveMap.set(key, seg.curve);
	}

	// Rebuild segments only between consecutive points
	const newSegments: TrackEnvelopeSegment[] = [];
	const segmentKeys = new Set<string>();

	for (let i = 0; i < uniquePoints.length - 1; i++) {
		const fromPoint = uniquePoints[i];
		const toPoint = uniquePoints[i + 1];
		const key = `${fromPoint.id}-${toPoint.id}`;

		// Skip duplicate segments
		if (segmentKeys.has(key)) continue;
		segmentKeys.add(key);

		// Preserve curve if it existed, otherwise default to linear
		const curve = curveMap.get(key) ?? 0;

		newSegments.push({
			id: crypto.randomUUID(),
			fromPointId: fromPoint.id,
			toPointId: toPoint.id,
			curve,
		});
	}

	return {
		enabled: envelope.enabled,
		points: uniquePoints,
		segments: newSegments,
	};
}

/**
 * Shift envelope automation points in range [startMs, endMs] by deltaMs
 * Range is inclusive on both endpoints
 * Preserves segment curves and enforces invariants
 * @internal Use shiftTrackAutomationInRange for track-level operations
 */
export function shiftEnvelopeAutomationInRange(
	envelope: TrackEnvelope,
	startMs: number,
	endMs: number,
	deltaMs: number,
): TrackEnvelope {
	const points = envelope.points || [];
	const shifted = points.map((point) => {
		// Inclusive range check
		if (point.time >= startMs && point.time <= endMs) {
			return { ...point, time: Math.max(0, point.time + deltaMs) };
		}
		return point;
	});

	const updated: TrackEnvelope = {
		...envelope,
		points: shifted,
	};

	// Rebuild to enforce invariants
	return rebuildAdjacencyEnvelope(updated);
}

/**
 * Remove envelope automation points in range [startMs, endMs]
 * Range is inclusive on both endpoints
 * Removes segments referencing deleted points and enforces invariants
 * @internal Use removeTrackAutomationPointsInRange for track-level operations
 */
export function removeEnvelopeAutomationPointsInRange(
	envelope: TrackEnvelope,
	startMs: number,
	endMs: number,
): TrackEnvelope {
	const points = envelope.points || [];
	// Find points to remove (inclusive range)
	const removeIds = new Set(
		points
			.filter((point) => point.time >= startMs && point.time <= endMs)
			.map((p) => p.id),
	);

	// Remove points
	const remainingPoints = points.filter((p) => !removeIds.has(p.id));

	// Remove segments that reference removed points
	const remainingSegments = (envelope.segments || []).filter(
		(seg) => !removeIds.has(seg.fromPointId) && !removeIds.has(seg.toPointId),
	);

	const updated: TrackEnvelope = {
		...envelope,
		points: remainingPoints,
		segments: remainingSegments,
	};

	// Rebuild to enforce invariants
	return rebuildAdjacencyEnvelope(updated);
}

/**
 * Shift track automation points in range [startMs, endMs] by deltaMs
 * Null-safe track-level wrapper that handles missing envelopes
 * Range is inclusive; clamps times to ≥ 0; rebuilds adjacency
 */
export function shiftTrackAutomationInRange(
	track: Track,
	startMs: number,
	endMs: number,
	deltaMs: number,
): Track {
	const envelope = track.volumeEnvelope ?? {
		enabled: true,
		points: [],
		segments: [],
	};

	if (!envelope.points || envelope.points.length === 0) {
		return track;
	}

	const updatedEnvelope = shiftEnvelopeAutomationInRange(
		envelope,
		startMs,
		endMs,
		deltaMs,
	);

	return {
		...track,
		volumeEnvelope: updatedEnvelope,
	};
}

/**
 * Remove track automation points in range [startMs, endMs]
 * Null-safe track-level wrapper that handles missing envelopes
 * Range is inclusive; cleans up orphan segments; rebuilds adjacency
 */
export function removeTrackAutomationPointsInRange(
	track: Track,
	startMs: number,
	endMs: number,
): Track {
	const envelope = track.volumeEnvelope ?? {
		enabled: true,
		points: [],
		segments: [],
	};

	if (!envelope.points || envelope.points.length === 0) {
		return track;
	}

	const updatedEnvelope = removeEnvelopeAutomationPointsInRange(
		envelope,
		startMs,
		endMs,
	);

	return {
		...track,
		volumeEnvelope: updatedEnvelope,
	};
}
