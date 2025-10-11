import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import {
	type Clip,
	clipInspectorOpenAtom,
	clipInspectorTargetAtom,
	type TrackEnvelope,
	tracksAtom,
	updateClipAtom,
	updateTrackAtom,
} from "@/lib/daw-sdk";

const MAX_FADE_MS = 120_000;

export function useClipInspector() {
	const [open, setOpen] = useAtom(clipInspectorOpenAtom);
	const [target, setTarget] = useAtom(clipInspectorTargetAtom);
	const [tracks] = useAtom(tracksAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);

	const [fadeInDraft, setFadeInDraft] = useState<number>(0);
	const [fadeOutDraft, setFadeOutDraft] = useState<number>(0);

	const current = useMemo(() => {
		if (!target) return null;
		const track = tracks.find((candidate) => candidate.id === target.trackId);
		const clip = track?.clips?.find(
			(candidate) => candidate.id === target.clipId,
		);
		return track && clip ? { track, clip } : null;
	}, [target, tracks]);

	// Sync fade drafts with clip fades
	useEffect(() => {
		if (!current) return;
		setFadeInDraft(current.clip.fadeIn ?? 0);
		setFadeOutDraft(current.clip.fadeOut ?? 0);
	}, [current]);

	const close = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setTarget(null);
		}
	};

	const handleToggleEnvelope = () => {
		if (!current) return;
		const existing = current.track.volumeEnvelope ?? {
			enabled: false,
			points: [
				{
					id: crypto.randomUUID(),
					time: current.clip.startTime,
					value: 1.0, // 100% multiplier = no change from base volume
				},
			],
			segments: [],
		};
		updateTrack(current.track.id, {
			volumeEnvelope: {
				...existing,
				enabled: !existing.enabled,
			},
		});
	};

	const handleEnvelopeChange = (envelope: TrackEnvelope) => {
		if (!current) return;

		// Auto-migrate and normalize
		const { migrateAutomationToSegments } = require("@/lib/daw-sdk");
		const migrated = migrateAutomationToSegments(envelope);

		const normalized = {
			...migrated,
			enabled: true,
			points: migrated.points
				.map((point) => ({
					...point,
					time: Math.max(0, Math.round(point.time)),
					value: Math.min(4, Math.max(0, point.value)),
				}))
				.sort((a, b) => a.time - b.time),
		};

		updateTrack(current.track.id, {
			volumeEnvelope: normalized,
		});
	};

	const commitFade = (key: "fadeIn" | "fadeOut", raw: number) => {
		if (!current) return;
		const clamped = Number.isFinite(raw)
			? Math.max(0, Math.min(MAX_FADE_MS, Math.round(raw)))
			: 0;
		updateClip(current.track.id, current.clip.id, { [key]: clamped });
		if (key === "fadeIn") setFadeInDraft(clamped);
		if (key === "fadeOut") setFadeOutDraft(clamped);
	};

	// Helper to update clip with partial updates
	const handleUpdateClip = (updates: Partial<Clip>) => {
		if (!current) return;
		updateClip(current.track.id, current.clip.id, updates);
	};

	return {
		open,
		current,
		fadeInDraft,
		fadeOutDraft,
		envelope: current?.track.volumeEnvelope ?? {
			enabled: false,
			points: [],
			segments: [],
		},
		setFadeInDraft,
		setFadeOutDraft,
		close,
		handleToggleEnvelope,
		handleEnvelopeChange,
		commitFade,
		updateClip: handleUpdateClip,
		MAX_FADE_MS,
	};
}
