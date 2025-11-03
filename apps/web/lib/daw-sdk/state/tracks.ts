/**
 * Track State Atoms - Legacy Layer
 *
 * NOTE: These write atoms use the old audioService/playbackService directly.
 * For new code, prefer using `useBridgeMutations()` from @wav0/daw-react
 * which provides bridge-based mutations with event-driven sync.
 *
 * These atoms remain for backward compatibility during migration.
 */

import { volume } from "@wav0/daw-sdk";
import { atom } from "jotai";
import { generateTrackId } from "@/lib/storage/opfs";
import { audioService, playbackService } from "../index";
import { bindEnvelopeToClips } from "../utils/automation-migration-helpers";
import {
	playbackAtom,
	projectEndOverrideAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	tracksAtom,
} from "./atoms";
import { migrateAutomationToSegments } from "./automation-migration";
import type { Clip, Track, TrackEnvelope, TrackEnvelopePoint } from "./types";
import { clampEnvelopeGain, createDefaultEnvelope } from "./types";

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

		// Synchronize with playback service if playing to initialize new track
		const playback = get(playbackAtom);
		if (playback.isPlaying) {
			try {
				await playbackService.synchronizeTracks(updatedTracks);
			} catch (error) {
				console.error(
					"Failed to synchronize tracks after adding new track",
					error,
				);
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
				// Bind points to clips before migrating/clamping
				const clips = updates.clips ?? track.clips;
				const bound = bindEnvelopeToClips(updates.volumeEnvelope, clips);
				// Auto-migrate envelope if needed
				const migrated = migrateAutomationToSegments(bound);

				const normalizedEnvelope: TrackEnvelope = {
					...migrated,
					points: migrated.points
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
		try {
			await playbackService.synchronizeTracks(updatedTracks);
		} catch (error) {
			console.error("Failed to synchronize tracks after track update", error);
		}

		if (typeof updates.volume === "number") {
			playbackService.updateTrackVolume(trackId, updates.volume);
		}
		if (typeof updates.muted === "boolean") {
			const vol =
				typeof updates.volume === "number"
					? updates.volume
					: updatedTrack.volume;
			playbackService.updateTrackMute(trackId, updates.muted, vol);
		}
		if (typeof updates.soloed === "boolean") {
			playbackService.updateSoloStates(updatedTracks);
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
	const tracks = get(tracksAtom);
	for (const track of tracks) {
		if (!track.opfsFileId || !track.audioFileName) continue;
		try {
			await audioService.loadTrackFromOPFS(
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
		const opfsFileId = generateTrackId();
		const audioInfo = await audioService.loadAudioFile(file, opfsFileId);

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
				if (playback.isPlaying) {
					try {
						await playbackService.rescheduleTrack(updatedTrack);
					} catch (error) {
						console.error(
							"Failed to reschedule after adding clip",
							existingTrackId,
							error,
						);
					}
				}

				return updatedTrack;
			}
		}

		const newTrackId = generateTrackId();
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
		if (playback.isPlaying) {
			try {
				// Pass all tracks to ensure new track is included in synchronization
				const allTracks = get(tracksAtom);
				await playbackService.rescheduleTrack(newTrack, allTracks);
			} catch (error) {
				console.error(
					"Failed to reschedule after creating track",
					newTrackId,
					error,
				);
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

/**
 * Clear all tracks and create a default Track 1
 */
export const clearTracksAtom = atom(null, (_get, set) => {
	// Clear all tracks and create default Track 1
	const defaultTrack: Track = {
		id: crypto.randomUUID(),
		name: "Track 1",
		duration: 0,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		volume: 75,
		volumeDb: volume.volumeToDb(75),
		muted: false,
		soloed: false,
		color: "#3b82f6",
		clips: [],
		volumeEnvelope: createDefaultEnvelope(75),
	};

	set(tracksAtom, [defaultTrack]);
	set(selectedTrackIdAtom, null);
	set(selectedClipIdAtom, null);

	// Reset playback
	playbackService.stop().catch(console.error);
});

/**
 * Reset entire project to default state
 */
export const resetProjectAtom = atom(null, (_get, set) => {
	// Stop playback
	playbackService.stop().catch(console.error);

	// Clear persisted tracks
	const defaultTrack: Track = {
		id: crypto.randomUUID(),
		name: "Track 1",
		duration: 0,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		volume: 75,
		volumeDb: volume.volumeToDb(75),
		muted: false,
		soloed: false,
		color: "#3b82f6",
		clips: [],
		volumeEnvelope: createDefaultEnvelope(75),
	};

	set(tracksAtom, [defaultTrack]);
	set(selectedTrackIdAtom, null);
	set(selectedClipIdAtom, null);
	set(projectEndOverrideAtom, null);
});

export const totalDurationAtom = atom((get) => {
	const tracks = get(tracksAtom);
	if (tracks.length === 0) return 0;

	const override = get(projectEndOverrideAtom);

	const perTrackEnds = tracks.map((track) => {
		if (track.clips && track.clips.length > 0) {
			return Math.max(
				...track.clips.map((clip) => {
					const oneShotEnd =
						clip.startTime + Math.max(0, clip.trimEnd - clip.trimStart);
					const loopEnd = clip.loop ? (clip.loopEnd ?? oneShotEnd) : oneShotEnd;
					return loopEnd;
				}),
				0,
			);
		}
		return track.startTime + track.duration;
	});

	const tracksDuration = Math.max(...perTrackEnds, 0);
	const minimumDuration = 180_000;

	if (override !== null) {
		return Math.max(override, tracksDuration);
	}

	return Math.max(tracksDuration, minimumDuration);
});
