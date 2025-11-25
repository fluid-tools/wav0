/**
 * Track Write Atoms
 * Actions for track CRUD operations
 */

"use client";

import type {
	Clip,
	Track,
	TrackEnvelope,
	TrackEnvelopePoint,
} from "@wav0/daw-sdk";
import { atom } from "jotai";
import {
	createDefaultEnvelope,
	createDefaultTrack,
	playbackAtom,
	projectEndOverrideAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	totalDurationAtom,
	tracksAtom,
} from "./base";
import { serviceRegistry } from "./service-registry";

// ===== Helper Functions =====

export function clampEnvelopeGain(value: number): number {
	return Math.max(0, Math.min(4, value));
}

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

export const addTrackAtom = atom(
	null,
	async (get, set, track: Omit<Track, "id">) => {
		const tracks = get(tracksAtom);
		const newTrack: Track = {
			...track,
			id: crypto.randomUUID(),
			volumeEnvelope: track.volumeEnvelope
				? {
						...track.volumeEnvelope,
						points: track.volumeEnvelope.points.map((point) => ({
							...point,
							value: clampEnvelopeGain(point.value),
						})),
					}
				: createDefaultEnvelope(track.volume ?? 75),
		};
		const updatedTracks = [...tracks, newTrack];
		set(tracksAtom, updatedTracks);

		// Synchronize with playback service if playing
		const playback = get(playbackAtom);
		if (playback.isPlaying && serviceRegistry.playbackService) {
			try {
				await serviceRegistry.playbackService.synchronizeTracks(updatedTracks);
			} catch (error) {
				console.error("Failed to synchronize tracks after adding", error);
			}
		}

		return newTrack.id;
	},
);

export const removeTrackAtom = atom(null, (get, set, trackId: string) => {
	const tracks = get(tracksAtom);
	set(
		tracksAtom,
		tracks.filter((track) => track.id !== trackId),
	);

	const selectedId = get(selectedTrackIdAtom);
	if (selectedId === trackId) {
		set(selectedTrackIdAtom, null);
	}
});

export const updateTrackAtom = atom(
	null,
	async (get, set, trackId: string, updates: Partial<Track>) => {
		const tracks = get(tracksAtom);
		const updatedTracks = tracks.map((track) => {
			if (track.id !== trackId) return track;
			if (updates.volumeEnvelope) {
				// Bind points to clips before normalizing
				const clips = updates.clips ?? track.clips;
				const bound = bindEnvelopeToClips(updates.volumeEnvelope, clips);

				const normalizedEnvelope: TrackEnvelope = {
					...bound,
					points: bound.points
						.map((point: TrackEnvelopePoint) => ({
							...point,
							value: clampEnvelopeGain(point.value),
						}))
						.sort(
							(a: TrackEnvelopePoint, b: TrackEnvelopePoint) => a.time - b.time,
						),
				};
				return { ...track, ...updates, volumeEnvelope: normalizedEnvelope };
			}
			return { ...track, ...updates };
		});
		set(tracksAtom, updatedTracks);

		const updatedTrack = updatedTracks.find((t) => t.id === trackId);
		if (!updatedTrack) return;

		// Sync with playback service
		if (serviceRegistry.playbackService) {
			try {
				await serviceRegistry.playbackService.synchronizeTracks(updatedTracks);
			} catch (error) {
				console.error("Failed to synchronize tracks after update", error);
			}

			if (typeof updates.volume === "number") {
				serviceRegistry.playbackService.updateTrackVolume(
					trackId,
					updates.volume,
				);
			}
			if (typeof updates.muted === "boolean") {
				const track = updatedTracks.find((t) => t.id === trackId);
				const soloEngaged = updatedTracks.some((t) => t.soloed);
				const isSoloed = track?.soloed ?? false;
				serviceRegistry.playbackService.updateTrackMute(
					trackId,
					updates.muted,
					isSoloed,
					soloEngaged,
				);
			}
			if (typeof updates.soloed === "boolean") {
				serviceRegistry.playbackService.updateSoloStates(updatedTracks);
			}
		}
	},
);

export const renameTrackAtom = atom(
	null,
	async (_get, set, trackId: string, name: string) => {
		const safe = name.trim();
		if (!safe) return;
		await set(updateTrackAtom, trackId, { name: safe });
	},
);

export const initializeAudioFromOPFSAtom = atom(null, async (get, _set) => {
	if (!serviceRegistry.audioService) {
		console.warn("Audio service not registered");
		return;
	}
	const tracks = get(tracksAtom);
	for (const track of tracks) {
		if (!track.opfsFileId || !track.audioFileName) continue;
		try {
			await serviceRegistry.audioService.loadTrackFromOPFS(
				track.opfsFileId,
				track.audioFileName,
			);
		} catch (error) {
			console.error("Failed to load track from OPFS:", track.name, error);
		}
	}
});

export const loadAudioFileAtom = atom(
	null,
	async (
		get,
		set,
		file: File,
		existingTrackId?: string,
		opts?: { startTimeMs?: number },
	) => {
		if (!serviceRegistry.audioService) {
			throw new Error("Audio service not registered");
		}

		const generateId = serviceRegistry.generateTrackId ?? crypto.randomUUID;
		const opfsFileId = generateId();
		const audioInfo = await serviceRegistry.audioService.loadAudioFile(
			file,
			opfsFileId,
		);

		if (existingTrackId) {
			const tracks = get(tracksAtom);
			const existingTrack = tracks.find((t) => t.id === existingTrackId);
			if (existingTrack) {
				const clipId = crypto.randomUUID();
				const clip: Clip = {
					id: clipId,
					name: file.name.replace(/\.[^/.]+$/, ""),
					opfsFileId,
					audioFileName: audioInfo.fileName,
					audioFileType: audioInfo.fileType,
					startTime: opts?.startTimeMs ?? existingTrack.startTime,
					trimStart: 0,
					trimEnd: audioInfo.duration * 1000,
					sourceDurationMs: audioInfo.duration * 1000,
					fadeInCurve: 0,
					fadeOutCurve: 0,
					color: existingTrack.color,
				};

				const updatedTrack: Track = {
					...existingTrack,
					name: clip.name,
					duration: audioInfo.duration * 1000,
					trimStart: 0,
					trimEnd: audioInfo.duration * 1000,
					opfsFileId,
					audioFileName: audioInfo.fileName,
					audioFileType: audioInfo.fileType,
					clips: [...(existingTrack.clips ?? []), clip],
				};

				set(
					tracksAtom,
					tracks.map((t) => (t.id === existingTrackId ? updatedTrack : t)),
				);

				const playback = get(playbackAtom);
				if (playback.isPlaying && serviceRegistry.playbackService) {
					try {
						await serviceRegistry.playbackService.rescheduleTrack(updatedTrack);
					} catch (error) {
						console.error("Failed to reschedule after adding clip", error);
					}
				}

				return updatedTrack;
			}
		}

		const newTrackId = generateId();
		const clipId = crypto.randomUUID();
		const clip: Clip = {
			id: clipId,
			name: file.name.replace(/\.[^/.]+$/, ""),
			opfsFileId,
			audioFileName: audioInfo.fileName,
			audioFileType: audioInfo.fileType,
			startTime: opts?.startTimeMs ?? 0,
			trimStart: 0,
			trimEnd: audioInfo.duration * 1000,
			sourceDurationMs: audioInfo.duration * 1000,
			fadeInCurve: 0,
			fadeOutCurve: 0,
			color: "#3b82f6",
		};

		const newTrack: Track = {
			id: newTrackId,
			name: clip.name,
			duration: audioInfo.duration * 1000,
			startTime: 0,
			trimStart: 0,
			trimEnd: audioInfo.duration * 1000,
			volume: 75,
			muted: false,
			soloed: false,
			color: "#3b82f6",
			opfsFileId,
			audioFileName: audioInfo.fileName,
			audioFileType: audioInfo.fileType,
			clips: [clip],
		};

		set(tracksAtom, [...get(tracksAtom), newTrack]);

		const playback = get(playbackAtom);
		if (playback.isPlaying && serviceRegistry.playbackService) {
			try {
				const allTracks = get(tracksAtom);
				await serviceRegistry.playbackService.rescheduleTrack(
					newTrack,
					allTracks,
				);
			} catch (error) {
				console.error("Failed to reschedule after creating track", error);
			}
		}

		return newTrack;
	},
);

export const selectedTrackAtom = atom((get) => {
	const tracks = get(tracksAtom);
	const selectedId = get(selectedTrackIdAtom);
	return tracks.find((track) => track.id === selectedId) || null;
});

export const clearTracksAtom = atom(null, (_get, set) => {
	const defaultTrack = createDefaultTrack("Track 1", "#3b82f6");
	set(tracksAtom, [defaultTrack]);
	set(selectedTrackIdAtom, null);
	set(selectedClipIdAtom, null);

	serviceRegistry.playbackService?.stop().catch(console.error);
});

export const resetProjectAtom = atom(null, (_get, set) => {
	serviceRegistry.playbackService?.stop().catch(console.error);

	const defaultTrack = createDefaultTrack("Track 1", "#3b82f6");
	set(tracksAtom, [defaultTrack]);
	set(selectedTrackIdAtom, null);
	set(selectedClipIdAtom, null);
	set(projectEndOverrideAtom, null);
});

// Re-export totalDurationAtom from base (it's a derived atom)
export { totalDurationAtom };
