"use client";

import { atom } from "jotai";
import { playbackService } from "../index";
import { bindEnvelopeToClips } from "../utils/automation-migration-helpers";
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
		_options?: { moveAutomation?: boolean },
	) => {
		const tracks = get(tracksAtom);
		const playback = get(playbackAtom);

		// Find original clip and track to detect automation movement
		const originalTrack = tracks.find((t) => t.id === trackId);
		const originalClip = originalTrack?.clips?.find((c) => c.id === clipId);

		// Detect clip movement for clip-bound automation (even without moveAutomation flag)
		const clipMoved =
			updates.startTime !== undefined &&
			originalClip &&
			originalClip.startTime !== updates.startTime;
		const updatedTracks = tracks.map((track) => {
			if (track.id !== trackId || !track.clips) return track;

			// Normalize envelope FIRST with original clips to bind track-level points
			let normalizedEnvelope = track.volumeEnvelope;
			if (normalizedEnvelope) {
				normalizedEnvelope = bindEnvelopeToClips(
					normalizedEnvelope,
					track.clips,
				);
			}

			// Update clip
			const updatedClips = track.clips.map((clip) =>
				clip.id === clipId ? { ...clip, ...updates } : clip,
			);
			const nextClip = updatedClips.find((clip) => clip.id === clipId);
			const nextStartTime =
				nextClip?.startTime ??
				updates.startTime ??
				originalClip?.startTime ??
				0;

			// Handle automation movement
			if (normalizedEnvelope && originalClip && clipMoved) {
				// Move two types of automation:
				// 1. Clip-bound automation (always moves with clip)
				// 2. Range-based automation (if moveAutomation flag is set)
				const shiftedPoints = normalizedEnvelope.points.map((point) => {
					// Clip-bound automation: always move with clip
					if (point.clipId === clipId) {
						const derivedRelative =
							point.clipRelativeTime !== undefined
								? point.clipRelativeTime
								: point.time - originalClip.startTime;
						const relativeTime = Math.max(0, derivedRelative);
						return {
							...point,
							time: nextStartTime + relativeTime,
							clipRelativeTime: relativeTime,
							clipId, // Keep clipId bound
						};
					}

					return point;
				});

				const movedEnvelope = {
					...normalizedEnvelope,
					points: shiftedPoints,
				};

				// Rebind with updated clips to ensure bindings stay correct
				const finalEnvelope = bindEnvelopeToClips(movedEnvelope, updatedClips);

				return {
					...track,
					clips: updatedClips,
					volumeEnvelope: finalEnvelope,
				};
			}

			// If envelope was normalized but clip didn't move, rebind with updated clips
			if (normalizedEnvelope && normalizedEnvelope !== track.volumeEnvelope) {
				const finalEnvelope = bindEnvelopeToClips(
					normalizedEnvelope,
					updatedClips,
				);
				return {
					...track,
					clips: updatedClips,
					volumeEnvelope: finalEnvelope,
				};
			}

			return {
				...track,
				clips: updatedClips,
			};
		});

		set(tracksAtom, updatedTracks);

		// Synchronize via global path (no direct reschedule)
		if (playback.isPlaying) {
			try {
				await playbackService.synchronizeTracks(updatedTracks);
			} catch (error) {
				console.error("Failed to synchronize tracks after clip update", error);
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

		// Synchronize via global path (no direct stop/reschedule)
		if (playback.isPlaying) {
			playbackService.synchronizeTracks(updatedTracks).catch(console.error);
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
			// Synchronize all tracks to ensure original clip stops and both split clips start correctly
			await playbackService.synchronizeTracks(updatedTracks);
		} catch (error) {
			console.error("Failed to reschedule after split", track.id, error);
		}
	}
});
