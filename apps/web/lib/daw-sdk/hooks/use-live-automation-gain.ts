"use client";

import { volume } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import type { TrackEnvelopePoint, TrackEnvelopeSegment } from "@/lib/daw-sdk";
import { playbackAtom, tracksAtom } from "@/lib/daw-sdk";

/**
 * Hook to get the current automated gain value for a track during playback
 * Returns effective dB at the current playhead position
 */
export function useLiveAutomationGain(trackId: string): {
	currentDb: number | null;
	envelopeDb: number | null;
	isAutomated: boolean;
} {
	const [playback] = useAtom(playbackAtom);
	const [tracks] = useAtom(tracksAtom);
	const [currentDb, setCurrentDb] = useState<number | null>(null);
	const [envelopeDb, setEnvelopeDb] = useState<number | null>(null);

	useEffect(() => {
		const track = tracks.find((t) => t.id === trackId);
		if (!track) {
			setCurrentDb(null);
			setEnvelopeDb(null);
			return;
		}

		const envelope = track.volumeEnvelope;
		if (
			!envelope?.enabled ||
			!envelope.points ||
			envelope.points.length === 0
		) {
			setCurrentDb(null);
			setEnvelopeDb(null);
			return;
		}

		const currentTimeMs = playback.currentTime;
		const multiplier = getEnvelopeMultiplierAtTime(
			envelope.points,
			envelope.segments || [],
			currentTimeMs,
		);
		const effectiveDb = volume.getEffectiveDb(track.volume ?? 75, multiplier);
		const envelopeDbValue = volume.multiplierToDb(multiplier);

		setCurrentDb(effectiveDb);
		setEnvelopeDb(envelopeDbValue);
	}, [trackId, tracks, playback.currentTime]);

	const track = tracks.find((t) => t.id === trackId);
	const isAutomated =
		Boolean(track?.volumeEnvelope?.enabled) &&
		(track?.volumeEnvelope?.points?.length ?? 0) > 0;

	return { currentDb, envelopeDb, isAutomated };
}

/**
 * Get the envelope multiplier at a specific time
 * Interpolates between points based on curve type from segments
 */
function getEnvelopeMultiplierAtTime(
	points: TrackEnvelopePoint[],
	segments: TrackEnvelopeSegment[],
	timeMs: number,
): number {
	if (points.length === 0) return 1.0;

	const sorted = [...points].sort((a, b) => a.time - b.time);

	// Before first point - use first point value
	if (timeMs <= sorted[0].time) {
		return sorted[0].value;
	}

	// After last point - use last point value
	if (timeMs >= sorted[sorted.length - 1].time) {
		return sorted[sorted.length - 1].value;
	}

	// Find the two points we're between
	for (let i = 0; i < sorted.length - 1; i++) {
		const p1 = sorted[i];
		const p2 = sorted[i + 1];

		if (timeMs >= p1.time && timeMs <= p2.time) {
			// Find the segment between these points
			const segment = segments.find(
				(seg) => seg.fromPointId === p1.id && seg.toPointId === p2.id,
			);
			const curve = segment?.curve ?? 0;

			// Interpolate between p1 and p2
			const progress = (timeMs - p1.time) / (p2.time - p1.time);
			return interpolateValue(p1.value, p2.value, progress, curve);
		}
	}

	// Fallback (shouldn't reach here)
	return 1.0;
}

/**
 * Interpolate between two values based on curve value (-99 to +99)
 */
function interpolateValue(
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
