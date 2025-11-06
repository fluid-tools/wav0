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
	const relativeTime = point.time - clipStartTime;
	return {
		...point,
		time: relativeTime,
		clipRelativeTime: relativeTime,
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
	// If clipRelativeTime is defined, use it directly
	// Otherwise, if clip-bound, derive relative time from absolute time
	// If not clip-bound, point.time is already absolute
	const relativeTime =
		point.clipRelativeTime !== undefined
			? point.clipRelativeTime
			: point.clipId
				? point.time - clipStartTime // Derive relative time from absolute time
				: point.time; // Not clip-bound: use absolute time as-is
	return {
		...point,
		time: relativeTime + clipStartTime,
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
		epsilonMs: _epsilonMs = 0.5,
	} = options;

	const isClipAttached = mode === "clip-attached";
	const clipDuration = Math.max(0, sourceEndMs - sourceStartMs);

	// Select points to transfer
	const pointsToTransfer = sourceEnvelope.points.filter((point) => {
		const absoluteTime =
			point.clipRelativeTime !== undefined
				? point.clipRelativeTime + sourceStartMs
				: point.time;
		const withinRange =
			absoluteTime >= sourceStartMs &&
			(includeEndBoundary
				? absoluteTime <= sourceEndMs
				: absoluteTime < sourceEndMs);

		if (isClipAttached) {
			if (point.clipId !== clipId) return false;
			return withinRange;
		}
		return withinRange;
	});

	if (pointsToTransfer.length === 0) {
		return {
			pointsToAdd: [],
			segmentsToAdd: [],
			pointIdsToRemove: [],
		};
	}

	const oldToNewId = new Map<string, string>();
	const pointIdsToRemove = pointsToTransfer.map((p) => p.id);
	const maxRelativeByProject = Number.isFinite(projectEndMs)
		? Math.max(0, projectEndMs - Math.max(0, targetStartMs))
		: Number.POSITIVE_INFINITY;

	const pointsToAdd = pointsToTransfer
		.map((point) => {
			const newId = crypto.randomUUID();
			oldToNewId.set(point.id, newId);

			if (isClipAttached) {
				const rawRelative =
					point.clipRelativeTime ?? point.time - sourceStartMs;
				const relativeCap = Math.min(
					clipDuration || Number.POSITIVE_INFINITY,
					maxRelativeByProject,
				);
				const relativeTime = Number.isFinite(rawRelative)
					? Math.max(0, Math.min(relativeCap, rawRelative))
					: 0;
				const absoluteTime = Math.max(
					0,
					Math.min(projectEndMs, targetStartMs + relativeTime),
				);

				return {
					...point,
					id: newId,
					time: absoluteTime,
					clipRelativeTime: relativeTime,
					clipId: targetClipId,
				};
			}

			const timeOffset = targetStartMs - sourceStartMs;
			const absoluteTime = Math.max(
				0,
				Math.min(projectEndMs, point.time + timeOffset),
			);

			const { clipRelativeTime: _relative, ...rest } = point;

			return {
				...rest,
				id: newId,
				time: absoluteTime,
				clipId: point.clipId,
			};
		})
		.sort((a, b) => a.time - b.time);

	// Handle segments - only include if both endpoints transfer
	const pointIdSet = new Set(pointIdsToRemove);
	const segmentsToTransfer = (sourceEnvelope.segments || []).filter(
		(s) => pointIdSet.has(s.fromPointId) && pointIdSet.has(s.toPointId),
	);

	const seenSegmentKeys = new Set<string>();
	const segmentsToAdd = segmentsToTransfer.reduce<TrackEnvelopeSegment[]>(
		(acc, segment) => {
			const newFrom = oldToNewId.get(segment.fromPointId);
			const newTo = oldToNewId.get(segment.toPointId);
			if (!newFrom || !newTo) return acc;
			const key = `${newFrom}-${newTo}`;
			if (seenSegmentKeys.has(key)) return acc;
			seenSegmentKeys.add(key);
			acc.push({
				...segment,
				id: crypto.randomUUID(),
				fromPointId: newFrom,
				toPointId: newTo,
			});
			return acc;
		},
		[],
	);

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
			points: envelope.points.filter(
				(p) => p.time < startMs || p.time >= endMs,
			),
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

/**
 * Bind automation points to clips based on their position
 * Points that fall within a clip's time window get clipId/clipRelativeTime metadata
 * Points that no longer overlap any clip lose their clip binding
 */
export function bindEnvelopeToClips(
	envelope: TrackEnvelope,
	clips: Clip[] | undefined,
): TrackEnvelope {
	if (!clips || clips.length === 0) {
		// No clips: remove all clip bindings
		return {
			...envelope,
			points: envelope.points.map((point) => {
				const { clipId: _clipId, clipRelativeTime: _rel, ...rest } = point;
				return rest;
			}),
		};
	}

	return {
		...envelope,
		points: envelope.points.map((point) => {
			// Compute absolute time for this point
			const absoluteTime =
				point.clipRelativeTime !== undefined && point.clipId
					? // Point is already clip-bound: resolve from clip
						(() => {
							const boundClip = clips.find((c) => c.id === point.clipId);
							if (boundClip) {
								return boundClip.startTime + point.clipRelativeTime;
							}
							// Clip no longer exists: fall back to stored absolute time
							return point.time;
						})()
					: // Point is track-level: use absolute time directly
						point.time;

			// Find clip that contains this point
			const containingClip = clips.find((clip) => {
				const clipStart = clip.startTime;
				const clipEnd = clip.startTime + (clip.trimEnd - clip.trimStart);
				return absoluteTime >= clipStart && absoluteTime <= clipEnd;
			});

			if (containingClip) {
				// Bind to clip
				const relativeTime = absoluteTime - containingClip.startTime;
				return {
					...point,
					time: absoluteTime, // Keep absolute time for compatibility
					clipId: containingClip.id,
					clipRelativeTime: relativeTime,
				};
			}

			// No containing clip: remove clip binding
			const { clipId: _clipId, clipRelativeTime: _rel, ...rest } = point;
			return {
				...rest,
				time: absoluteTime,
			};
		}),
	};
}
