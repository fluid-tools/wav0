import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import {
	clipInspectorOpenAtom,
	clipInspectorTargetAtom,
	type TrackEnvelopePoint,
	tracksAtom,
	updateClipAtom,
	updateTrackAtom,
} from "@/lib/state/daw-store";

const MAX_FADE_MS = 120_000;

export function useClipInspector() {
	const [open, setOpen] = useAtom(clipInspectorOpenAtom);
	const [target, setTarget] = useAtom(clipInspectorTargetAtom);
	const [tracks] = useAtom(tracksAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);

	const [fadeInDraft, setFadeInDraft] = useState<number>(0);
	const [fadeOutDraft, setFadeOutDraft] = useState<number>(0);
	const [envelopeDraft, setEnvelopeDraft] = useState<TrackEnvelopePoint[]>([]);

	const current = useMemo(() => {
		if (!target) return null;
		const track = tracks.find((candidate) => candidate.id === target.trackId);
		const clip = track?.clips?.find(
			(candidate) => candidate.id === target.clipId,
		);
		return track && clip ? { track, clip } : null;
	}, [target, tracks]);

	useEffect(() => {
		if (!current) return;
		setFadeInDraft(current.clip.fadeIn ?? 0);
		setFadeOutDraft(current.clip.fadeOut ?? 0);
		const points = current.track.volumeEnvelope?.points ?? [];
		setEnvelopeDraft(points.map((point) => ({ ...point })));
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
					curve: "linear" as const,
				},
			],
		};
		updateTrack(current.track.id, {
			volumeEnvelope: {
				...existing,
				enabled: !existing.enabled,
			},
		});
	};

	const handleEnvelopeChange = (points: TrackEnvelopePoint[]) => {
		setEnvelopeDraft(points);
	};

	const handleEnvelopeSave = () => {
		if (!current) return;
		const normalized = envelopeDraft
			.map((point) => ({
				...point,
				time: Math.max(0, Math.round(point.time)),
				value: Math.min(4, Math.max(0, point.value)),
			}))
			.sort((a, b) => a.time - b.time);

		updateTrack(current.track.id, {
			volumeEnvelope: {
				enabled: true,
				points: normalized,
			},
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

	return {
		open,
		current,
		fadeInDraft,
		fadeOutDraft,
		envelopeDraft,
		setFadeInDraft,
		setFadeOutDraft,
		close,
		handleToggleEnvelope,
		handleEnvelopeChange,
		handleEnvelopeSave,
		commitFade,
		MAX_FADE_MS,
	};
}
