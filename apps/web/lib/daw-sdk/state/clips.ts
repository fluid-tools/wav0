"use client";

import { atom } from "jotai";
import { playbackService } from "../index";
import {
	playbackAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	tracksAtom,
} from "./atoms";
import type { Clip, Track } from "./types";

export const updateClipAtom = atom(
	null,
	async (
		get,
		set,
		trackId: string,
		clipId: string,
		updates: Partial<Clip>,
		options?: { moveAutomation?: boolean },
	) => {
		const tracks = get(tracksAtom);
		const playback = get(playbackAtom);

		// Find original clip and track to detect automation movement
		const originalTrack = tracks.find((t) => t.id === trackId);
		const originalClip = originalTrack?.clips?.find((c) => c.id === clipId);

		// Detect if we need to move automation
		const shouldMoveAutomation =
			options?.moveAutomation &&
			updates.startTime !== undefined &&
			originalClip &&
			originalClip.startTime !== updates.startTime &&
			originalTrack?.volumeEnvelope?.enabled;

		let automationDelta = 0;
		if (
			shouldMoveAutomation &&
			originalClip &&
			updates.startTime !== undefined
		) {
			automationDelta = updates.startTime - originalClip.startTime;
		}

		const updatedTracks = tracks.map((track) => {
			if (track.id !== trackId || !track.clips) return track;

			// Update clip
			const updatedClips = track.clips.map((clip) =>
				clip.id === clipId ? { ...clip, ...updates } : clip,
			);

			// Move automation if requested
			if (shouldMoveAutomation && track.volumeEnvelope && originalClip) {
				const clipEndTime =
					originalClip.startTime +
					(originalClip.trimEnd - originalClip.trimStart);

				// Shift automation points that fall within the clip's time range
				const shiftedPoints = track.volumeEnvelope.points.map((point) => {
					if (
						point.time >= originalClip.startTime &&
						point.time <= clipEndTime
					) {
						return { ...point, time: point.time + automationDelta };
					}
					return point;
				});

				return {
					...track,
					clips: updatedClips,
					volumeEnvelope: {
						...track.volumeEnvelope,
						points: shiftedPoints,
					},
				};
			}

			return {
				...track,
				clips: updatedClips,
			};
		});

		set(tracksAtom, updatedTracks);

		const updatedTrack = updatedTracks.find((track) => track.id === trackId);
		if (!updatedTrack) return;

		if (
			playback.isPlaying &&
			(updates.startTime !== undefined ||
				updates.trimStart !== undefined ||
				updates.trimEnd !== undefined ||
				updates.loop !== undefined ||
				updates.loopEnd !== undefined)
		) {
			try {
				await playbackService.rescheduleTrack(updatedTrack);
			} catch (error) {
				console.error(
					"Failed to reschedule track after clip update",
					trackId,
					clipId,
					error,
				);
			}
		}
	},
);

export const renameClipAtom = atom(
	null,
	async (_get, set, trackId: string, clipId: string, name: string) => {
		const trimmed = name.trim();
		if (!trimmed) return;
		await set(updateClipAtom, trackId, clipId, { name: trimmed });
	},
);

export const removeClipAtom = atom(
	null,
	async (get, set, trackId: string, clipId: string) => {
		const tracks = get(tracksAtom);
		const playback = get(playbackAtom);
		const selectedClipId = get(selectedClipIdAtom);

		const updatedTracks = tracks.map((track) => {
			if (track.id !== trackId || !track.clips) return track;
			return {
				...track,
				clips: track.clips.filter((clip) => clip.id !== clipId),
			};
		});

		set(tracksAtom, updatedTracks);

		if (selectedClipId === clipId) {
			set(selectedClipIdAtom, null);
		}

		const updatedTrack = updatedTracks.find((track) => track.id === trackId);
		if (!updatedTrack) return;

		if (playback.isPlaying) {
			try {
				const sourceTrack = tracks.find(
					(track) =>
						track.id !== trackId &&
						track.clips?.some((clip) => clip.id === clipId),
				);
				if (sourceTrack) {
					await playbackService.stopClip(sourceTrack.id, clipId);
				}
				await playbackService.rescheduleTrack(updatedTrack);
			} catch (error) {
				console.error(
					"Failed to reschedule track after clip removal",
					trackId,
					error,
				);
			}
		}
	},
);

export const splitClipAtPlayheadAtom = atom(null, async (get, set) => {
	const tracks = get(tracksAtom);
	const selectedTrackId = get(selectedTrackIdAtom);
	const selectedClipId = get(selectedClipIdAtom);
	const playback = get(playbackAtom);

	if (!selectedTrackId || !selectedClipId) return;

	const track = tracks.find((t) => t.id === selectedTrackId);
	if (!track || !track.clips) return;

	const clip = track.clips.find((c) => c.id === selectedClipId);
	if (!clip) return;

	const splitTimeMs = playback.currentTime;
	const clipStartMs = clip.startTime;
	const clipEndMs = clip.startTime + (clip.trimEnd - clip.trimStart);

	if (splitTimeMs <= clipStartMs || splitTimeMs >= clipEndMs) return;

	const offsetInClip = splitTimeMs - clip.startTime;

	const newLeft: Clip = {
		...clip,
		id: crypto.randomUUID(),
		trimEnd: clip.trimStart + offsetInClip,
	};

	const newRight: Clip = {
		...clip,
		id: crypto.randomUUID(),
		startTime: splitTimeMs,
		trimStart: clip.trimStart + offsetInClip,
	};

	newLeft.fadeOut = newLeft.fadeOut ?? 15;
	newRight.fadeIn = newRight.fadeIn ?? 15;

	const updatedClips = track.clips.flatMap((c) =>
		c.id === clip.id ? [newLeft, newRight] : c,
	) as Clip[];

	const updatedTrack: Track = { ...track, clips: updatedClips };
	const updatedTracks = tracks.map((t) =>
		t.id === track.id ? updatedTrack : t,
	);

	set(tracksAtom, updatedTracks);
	set(selectedClipIdAtom, newRight.id);

	if (playback.isPlaying) {
		try {
			await playbackService.rescheduleTrack(updatedTrack);
		} catch (error) {
			console.error("Failed to reschedule after split", track.id, error);
		}
	}
});
