/**
 * Clip Write Atoms
 * Actions for clip CRUD operations
 */

"use client";

import type { Clip, Track, TrackEnvelope } from "@wav0/daw-sdk";
import { atom } from "jotai";
import {
	playbackAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	tracksAtom,
} from "./base";
import { serviceRegistry } from "./service-registry";

// ===== Helper Functions =====

function bindEnvelopeToClips(
	envelope: TrackEnvelope,
	clips?: Clip[],
): TrackEnvelope {
	if (!clips || clips.length === 0) return envelope;

	const newPoints = envelope.points.map((point) => {
		// If point already has clipId, keep it
		if (point.clipId) return point;

		// Try to find a clip that contains this point's time
		for (const clip of clips) {
			const clipEnd = clip.startTime + clip.sourceDurationMs;
			if (point.time >= clip.startTime && point.time <= clipEnd) {
				return {
					...point,
					clipId: clip.id,
					clipRelativeTime: point.time - clip.startTime,
				};
			}
		}
		return point;
	});

	return { ...envelope, points: newPoints };
}

// ===== Write Atoms =====

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

		// Detect clip movement for clip-bound automation
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

				// Rebind with updated clips
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

		// Synchronize via global path
		if (playback.isPlaying && serviceRegistry.playbackService) {
			try {
				await serviceRegistry.playbackService.synchronizeTracks(updatedTracks);
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
			if (track.id !== trackId) return track;

			// Find the clip being deleted to get its start time for unbinding automation
			const clipToDelete = track.clips?.find((c) => c.id === clipId);
			const clipStartTime = clipToDelete?.startTime ?? 0;

			// Remove the clip
			const updatedClips =
				track.clips?.filter((clip) => clip.id !== clipId) ?? [];

			// Unbind automation points that reference this clip
			const updatedEnvelope = track.volumeEnvelope
				? {
						...track.volumeEnvelope,
						points: track.volumeEnvelope.points.map((point) => {
							if (point.clipId !== clipId) return point;
							// Convert to absolute time and unbind
							const absoluteTime =
								point.clipRelativeTime !== undefined
									? point.clipRelativeTime + clipStartTime
									: point.time;
							return {
								...point,
								time: absoluteTime,
								clipId: undefined,
								clipRelativeTime: undefined,
							};
						}),
					}
				: undefined;

			return {
				...track,
				clips: updatedClips,
				volumeEnvelope: updatedEnvelope,
			};
		});

		set(tracksAtom, updatedTracks);

		if (selectedClipId === clipId) {
			set(selectedClipIdAtom, null);
		}

		// Synchronize via global path
		if (playback.isPlaying && serviceRegistry.playbackService) {
			try {
				await serviceRegistry.playbackService.synchronizeTracks(updatedTracks);
			} catch (error) {
				console.error("Failed to synchronize tracks after clip removal", error);
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

	if (playback.isPlaying && serviceRegistry.playbackService) {
		try {
			await serviceRegistry.playbackService.synchronizeTracks(updatedTracks);
		} catch (error) {
			console.error("Failed to synchronize after split", error);
		}
	}
});

// ===== Derived Atoms =====

export const selectedClipAtom = atom((get) => {
	const tracks = get(tracksAtom);
	const selectedId = get(selectedClipIdAtom);
	if (!selectedId) return null;

	for (const track of tracks) {
		const clip = track.clips?.find((c) => c.id === selectedId);
		if (clip) return { clip, trackId: track.id };
	}
	return null;
});

