"use client";

import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { getEffectiveDb, multiplierToDb } from "@/lib/audio/volume";
import { playbackAtom, tracksAtom } from "@/lib/state/daw-store";
import type { TrackEnvelopePoint } from "@/lib/state/daw-store";

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
		if (!envelope?.enabled || !envelope.points || envelope.points.length === 0) {
			setCurrentDb(null);
			setEnvelopeDb(null);
			return;
		}

		const currentTimeMs = playback.currentTime;
		const multiplier = getEnvelopeMultiplierAtTime(
			envelope.points,
			currentTimeMs,
		);
		const effectiveDb = getEffectiveDb(track.volume, multiplier);
		const envelopeDbValue = multiplierToDb(multiplier);

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
 * Interpolates between points based on curve type
 */
function getEnvelopeMultiplierAtTime(
	points: TrackEnvelopePoint[],
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
			// Interpolate between p1 and p2
			const progress = (timeMs - p1.time) / (p2.time - p1.time);
			return interpolateValue(p1.value, p2.value, progress, p2.curve);
		}
	}

	// Fallback (shouldn't reach here)
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
			// Exponential ease-in (slow start, fast end)
			return start + (end - start) * progress * progress;
		case "easeOut":
			// Exponential ease-out (fast start, slow end)
			return start + (end - start) * (1 - (1 - progress) * (1 - progress));
		case "sCurve": {
			// S-curve (ease-in-out)
			const t =
				progress < 0.5
					? 2 * progress * progress
					: 1 - 2 * (1 - progress) * (1 - progress);
			return start + (end - start) * t;
		}
		case "linear":
		default:
			// Linear interpolation
			return start + (end - start) * progress;
	}
}

