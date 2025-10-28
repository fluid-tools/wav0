/**
 * Automation utilities for envelope management
 * Pure functions for automation point and segment operations
 */

import { curves } from "./curves";

// Forward type declarations - will be properly imported from types once created
export type TrackEnvelope = {
	enabled: boolean;
	points: TrackEnvelopePoint[];
	segments: TrackEnvelopeSegment[];
};

export type TrackEnvelopePoint = {
	id: string;
	time: number;
	value: number;
	clipId?: string;
	clipRelativeTime?: number;
};

export type TrackEnvelopeSegment = {
	id: string;
	fromPointId: string;
	toPointId: string;
	curve: number; // -99 to +99
};

export namespace automation {
	/**
	 * Get envelope multiplier at specific time with interpolation
	 * Uses segment-based curves (Logic Pro style)
	 */
	export function evaluateEnvelopeGainAt(
		envelope: TrackEnvelope | undefined,
		timeMs: number,
	): number {
		if (!envelope || !envelope.enabled || !envelope.points?.length) return 1.0;

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
				const segment = envelope.segments.find(
					(s) => s.fromPointId === p1.id && s.toPointId === p2.id,
				);

				const curve = segment?.curve ?? 0;

				return curves.evaluateSegmentCurve(p1.value, p2.value, progress, curve);
			}
		}

		return 1.0;
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

		const newSegments = [...envelope.segments];

		if (newIndex > 0) {
			const prevPoint = sortedPoints[newIndex - 1];

			if (newIndex < sortedPoints.length - 1) {
				const nextPoint = sortedPoints[newIndex + 1];
				const oldSegmentIndex = newSegments.findIndex(
					(s) => s.fromPointId === prevPoint.id && s.toPointId === nextPoint.id,
				);

				if (oldSegmentIndex >= 0) {
					const oldSegment = newSegments[oldSegmentIndex];
					newSegments.splice(oldSegmentIndex, 1);

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

		const newSegments = (envelope.segments || []).filter(
			(s) => s.fromPointId !== pointId && s.toPointId !== pointId,
		);

		if (sortedIndex > 0 && sortedIndex < sortedPoints.length - 1) {
			const prevPoint = sortedPoints[sortedIndex - 1];
			const nextPoint = sortedPoints[sortedIndex + 1];

			const prevSegment = envelope.segments.find((s) => s.toPointId === pointId);
			const nextSegment = envelope.segments.find(
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
			segments: envelope.segments.map((s) =>
				s.id === segmentId
					? { ...s, curve: Math.max(-99, Math.min(99, curve)) }
					: s,
			),
		};
	}

	/**
	 * Generate default linear segments between points
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
				curve: 0,
			});
		}

		return {
			...envelope,
			segments,
		};
	}

	/**
	 * Rebuild envelope to enforce adjacency invariant
	 */
	export function rebuildEnvelope(envelope: TrackEnvelope): TrackEnvelope {
		const sortedPoints = [...envelope.points]
			.map((p) => ({ ...p, time: Math.max(0, p.time) }))
			.sort((a, b) => a.time - b.time);

		const seenIds = new Set<string>();
		const uniquePoints = sortedPoints.filter((p) => {
			if (seenIds.has(p.id)) return false;
			seenIds.add(p.id);
			return true;
		});

		const curveMap = new Map<string, number>();
		for (const seg of envelope.segments) {
			const key = `${seg.fromPointId}-${seg.toPointId}`;
			curveMap.set(key, seg.curve);
		}

		const newSegments: TrackEnvelopeSegment[] = [];
		const segmentKeys = new Set<string>();

		for (let i = 0; i < uniquePoints.length - 1; i++) {
			const fromPoint = uniquePoints[i];
			const toPoint = uniquePoints[i + 1];
			const key = `${fromPoint.id}-${toPoint.id}`;

			if (segmentKeys.has(key)) continue;
			segmentKeys.add(key);

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
}

