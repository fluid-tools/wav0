/**
 * Automation Helper Functions
 * Used by components for clip-relative automation, range operations, etc.
 */

import { automation } from "@wav0/daw-sdk";
import type {
	Clip,
	Track,
	TrackEnvelope,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
} from "../types/schemas";

// Re-export SDK automation functions for backward compatibility
export const addAutomationPoint = automation.addAutomationPoint;
export const removeAutomationPoint = automation.removeAutomationPoint;
export const updateSegmentCurve = automation.updateSegmentCurve;

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
		time: point.time - clipStartTime,
		clipId,
	};
}

/**
 * Resolve clip-relative point to absolute time
 */
export function resolveClipRelativePoint(
	point: TrackEnvelopePoint,
	clipStartTime: number,
): TrackEnvelopePoint {
	return {
		...point,
		time: point.time + clipStartTime,
		clipId: undefined,
	};
}

/**
 * Options for automation transfer
 */
export interface AutomationTransferOptions {
	mode?: "clip-attached" | "time-range"; // default 'clip-attached'
	includeEndBoundary?: boolean; // default true
	epsilonMs?: number; // default 0.5
}

/**
 * Result of automation transfer computation
 */
export interface AutomationTransferResult {
	pointsToAdd: TrackEnvelopePoint[];
	segmentsToAdd: TrackEnvelopeSegment[];
	pointIdsToRemove: string[];
}

/**
 * Compute automation transfer with proper clip-attachment, boundary handling, and time clamping
 * This is the new, improved version that handles all edge cases correctly.
 */
export function computeAutomationTransfer(
	sourceEnvelope: TrackEnvelope,
	clipId: string,
	sourceStartMs: number,
	sourceEndMs: number,
	targetStartMs: number,
	targetClipId: string,
	projectEndMs: number,
	options: AutomationTransferOptions = {},
): AutomationTransferResult {
	const {
		mode = "clip-attached",
		includeEndBoundary = true,
		epsilonMs = 0.5,
	} = options;

	// Select points to transfer
	const pointsToTransfer = sourceEnvelope.points.filter((p) => {
		if (mode === "clip-attached") {
			// ONLY transfer points that belong to this clip
			// Track-level points (p.clipId === undefined) should stay on the track
			return p.clipId === clipId;
		}
		// Time-range mode: only consider time
		return (
			p.time >= sourceStartMs &&
			(includeEndBoundary ? p.time <= sourceEndMs : p.time < sourceEndMs)
		);
	});

	// Calculate time offset
	const timeOffset = targetStartMs - sourceStartMs;

	// Map old IDs to new IDs
	const oldToNewId = new Map<string, string>();
	const pointIdsToRemove = pointsToTransfer.map((p) => p.id);

	// Create new points with adjusted times
	const pointsToAdd = pointsToTransfer
		.map((p) => {
			const newId = crypto.randomUUID();
			oldToNewId.set(p.id, newId);

			// Clamp time to valid range
			const newTime = Math.max(0, Math.min(projectEndMs, p.time + timeOffset));

			return {
				...p,
				id: newId,
				time: newTime,
				clipId: targetClipId,
			};
		})
		.sort((a, b) => a.time - b.time); // Keep sorted

	// Handle segments - only include if both endpoints transfer
	const pointIdSet = new Set(pointIdsToRemove);
	const segmentsToTransfer = (sourceEnvelope.segments || []).filter(
		(s) => pointIdSet.has(s.fromPointId) && pointIdSet.has(s.toPointId),
	);

	const segmentsToAdd = segmentsToTransfer.map((s) => ({
		...s,
		id: crypto.randomUUID(),
		fromPointId: oldToNewId.get(s.fromPointId)!,
		toPointId: oldToNewId.get(s.toPointId)!,
	}));

	return {
		pointsToAdd,
		segmentsToAdd,
		pointIdsToRemove,
	};
}

/**
 * Merge automation points with deduplication based on time proximity
 * Prevents duplicate points at the same timestamp within epsilon tolerance
 */
export function mergeAutomationPoints(
	existingPoints: TrackEnvelopePoint[],
	newPoints: TrackEnvelopePoint[],
	epsilonMs = 0.5,
): TrackEnvelopePoint[] {
	// Build time index of existing points
	const timeMap = new Map<number, TrackEnvelopePoint>();

	for (const point of existingPoints) {
		const timeKey = Math.round(point.time / epsilonMs) * epsilonMs;
		timeMap.set(timeKey, point);
	}

	// Add new points, skipping duplicates
	const mergedPoints = [...existingPoints];

	for (const newPoint of newPoints) {
		const timeKey = Math.round(newPoint.time / epsilonMs) * epsilonMs;

		if (!timeMap.has(timeKey)) {
			mergedPoints.push(newPoint);
			timeMap.set(timeKey, newPoint);
		}
		// If duplicate exists, keep existing point
	}

	return mergedPoints.sort((a, b) => a.time - b.time);
}

/**
 * Extract automation points from a clip's time range and transfer to target position
 * Generates new IDs and adjusts timestamps to prevent duplication
 * @deprecated Use computeAutomationTransfer instead for better boundary and clip handling
 */
export function extractAndTransferAutomationPoints(
	sourceEnvelope: TrackEnvelope,
	clipStartMs: number,
	clipEndMs: number,
	targetStartMs: number,
	targetClipId: string,
): {
	pointsToTransfer: TrackEnvelopePoint[];
	segmentsToTransfer: TrackEnvelopeSegment[];
	pointIdsToRemove: string[];
} {
	// Use new function with backward-compatible mode
	const result = computeAutomationTransfer(
		sourceEnvelope,
		targetClipId, // assumes clipId matches targetClipId
		clipStartMs,
		clipEndMs,
		targetStartMs,
		targetClipId,
		Number.MAX_SAFE_INTEGER, // no project end limit
		{ mode: "time-range" }, // backward compat mode
	);

	return {
		pointsToTransfer: result.pointsToAdd,
		segmentsToTransfer: result.segmentsToAdd,
		pointIdsToRemove: result.pointIdsToRemove,
	};
}

/**
 * Legacy: Transfer automation envelope from one clip to another
 * @deprecated Use extractAndTransferAutomationPoints instead
 */
export function transferAutomationEnvelope(
	sourceEnvelope: TrackEnvelope,
	sourceClipId: string,
	targetClipId: string,
): TrackEnvelope {
	return {
		...sourceEnvelope,
		points: sourceEnvelope.points.map((p) =>
			p.clipId === sourceClipId ? { ...p, clipId: targetClipId } : p,
		),
	};
}

/**
 * Count automation points in a time range
 */
export function countAutomationPointsInRange(
	envelope: TrackEnvelope,
	startMs: number,
	endMs: number,
): number {
	return envelope.points.filter((p) => p.time >= startMs && p.time < endMs)
		.length;
}

/**
 * Remove automation points in a time range
 */
export function removeTrackAutomationPointsInRange(
	track: Track,
	startMs: number,
	endMs: number,
): Track {
	const envelope = track.volumeEnvelope;
	if (!envelope) return track;

	return {
		...track,
		volumeEnvelope: {
			...envelope,
			points: envelope.points.filter((p) => p.time < startMs || p.time >= endMs),
			segments: envelope.segments?.filter((s) => {
				const fromPoint = envelope.points.find((p) => p.id === s.fromPointId);
				const toPoint = envelope.points.find((p) => p.id === s.toPointId);
				if (!fromPoint || !toPoint) return false;
				return (
					(fromPoint.time < startMs || fromPoint.time >= endMs) &&
					(toPoint.time < startMs || toPoint.time >= endMs)
				);
			}),
		},
	};
}

/**
 * Shift automation points in a time range
 */
export function shiftTrackAutomationInRange(
	track: Track,
	startMs: number,
	shiftMs: number,
): Track {
	const envelope = track.volumeEnvelope;
	if (!envelope) return track;

	return {
		...track,
		volumeEnvelope: {
			...envelope,
			points: envelope.points.map((p) =>
				p.time >= startMs ? { ...p, time: p.time + shiftMs } : p,
			),
		},
	};
}

