"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { audioManager } from "@/lib/audio/audio-manager";
import { playbackEngine } from "@/lib/audio/playback-engine";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import { generateTrackId } from "@/lib/storage/opfs";

export type Track = {
	id: string;
	name: string;
	audioUrl?: string;
	audioBuffer?: ArrayBuffer;
	duration: number;
	startTime: number;
	trimStart: number;
	trimEnd: number;
	volume: number;
	muted: boolean;
	soloed: boolean;
	color: string;
	// OPFS file reference for persistent storage
	opfsFileId?: string;
	audioFileName?: string;
	audioFileType?: string;
	// Cached audio data from MediaBunny
	mediaBunnyInput?: unknown; // Will be typed properly in the audio handler
};

export type PlaybackState = {
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	bpm: number;
	looping: boolean;
};

export type TimelineState = {
	zoom: number;
	scrollPosition: number;
	snapToGrid: boolean;
	gridSize: number; // in milliseconds
};

export type DAWState = {
	projectName: string;
	tracks: Track[];
	playback: PlaybackState;
	timeline: TimelineState;
	selectedTrackId: string | null;
};

// Base atoms
export const tracksAtom = atomWithStorage<Track[]>("daw-tracks", []);
export const playbackAtom = atom<PlaybackState>({
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	bpm: 120,
	looping: false,
});

export const timelineAtom = atom<TimelineState>({
	zoom: 1,
	scrollPosition: 0,
	snapToGrid: true,
	gridSize: 1000, // 1 second
});

export const trackHeightZoomAtom = atom(1.0); // Track height zoom level (1.0 = 100px default)

export const selectedTrackIdAtom = atom<string | null>(null);
export const projectNameAtom = atomWithStorage<string>(
	"daw-project-name",
	"Untitled Project",
);

// Derived atoms
export const selectedTrackAtom = atom((get) => {
	const tracks = get(tracksAtom);
	const selectedId = get(selectedTrackIdAtom);
	return tracks.find((track) => track.id === selectedId) || null;
});

export const totalDurationAtom = atom((get) => {
	const tracks = get(tracksAtom);
	const tracksDuration = Math.max(
		...tracks.map((track) => track.startTime + track.duration),
		0,
	);
	const minimumDuration = 60 * 1000; // 60 seconds in ms
	return Math.max(tracksDuration, minimumDuration);
});

export const timelineWidthAtom = atom((get) => {
	const durationMs = get(totalDurationAtom);
	const zoom = get(timelineAtom).zoom;
	const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom) / 1000;
	const durationPx = durationMs * pxPerMs;
	const paddingPx = DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom * 10; // 10s visual buffer (zoom-aware)
	return durationPx + paddingPx;
});

export const projectEndPositionAtom = atom((get) => {
	const durationMs = get(totalDurationAtom);
	const zoom = get(timelineAtom).zoom;
	const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom) / 1000;
	return durationMs * pxPerMs;
});

// Action atoms
export const addTrackAtom = atom(null, (get, set, track: Omit<Track, "id">) => {
	const tracks = get(tracksAtom);
	const newTrack: Track = {
		...track,
		id: crypto.randomUUID(),
	};
	set(tracksAtom, [...tracks, newTrack]);
	return newTrack.id;
});

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
		const playback = get(playbackAtom);
		const updatedTracks = tracks.map((track) =>
			track.id === trackId ? { ...track, ...updates } : track,
		);
		set(tracksAtom, updatedTracks);

		// If playing, reschedule just the edited track for immediate audio correctness
		if (playback.isPlaying) {
			const updatedTrack = updatedTracks.find((t) => t.id === trackId);
			if (updatedTrack) {
				try {
					await playbackEngine.rescheduleTrack(updatedTrack);
				} catch (e) {
					console.error("Failed to reschedule track after update", trackId, e);
				}
			}
		}
	},
);

// Removed - replaced with audio-enabled version below

export const setCurrentTimeAtom = atom(null, async (get, set, time: number) => {
	const playback = get(playbackAtom);
	const tracks = get(tracksAtom);

	// Update the time first
	set(playbackAtom, { ...playback, currentTime: time });

	if (playback.isPlaying) {
		// Pause current playback
		await playbackEngine.pause();

		// Restart playback from new position
		await playbackEngine.play(tracks, {
			startTime: time / 1000,
			onTimeUpdate: (currentTime) => {
				const newPlayback = get(playbackAtom);
				set(playbackAtom, { ...newPlayback, currentTime: currentTime * 1000 });
			},
			onPlaybackEnd: () => {
				const endPlayback = get(playbackAtom);
				set(playbackAtom, { ...endPlayback, isPlaying: false });
			},
		});
	}
});

export const setTimelineZoomAtom = atom(null, (get, set, zoom: number) => {
	const timeline = get(timelineAtom);
	set(timelineAtom, { ...timeline, zoom });
});

export const setTrackHeightZoomAtom = atom(null, (_get, set, zoom: number) => {
	set(trackHeightZoomAtom, Math.max(0.6, Math.min(2.0, zoom)));
});

// Initialize audio files from OPFS on app startup
export const initializeAudioFromOPFSAtom = atom(null, async (get, _set) => {
	const tracks = get(tracksAtom);
	console.log("Initializing audio from OPFS for", tracks.length, "tracks");

	for (const track of tracks) {
		if (track.opfsFileId && track.audioFileName) {
			try {
				console.log(
					"Loading track from OPFS:",
					track.name,
					"opfsFileId:",
					track.opfsFileId,
				);
				await audioManager.loadTrackFromOPFS(
					track.opfsFileId,
					track.audioFileName,
				);
				console.log("Successfully loaded track from OPFS:", track.name);
			} catch (error) {
				console.error("Failed to load track from OPFS:", track.name, error);
			}
		}
	}
});

// Audio file operations
export const loadAudioFileAtom = atom(
	null,
	async (get, set, file: File, existingTrackId?: string) => {
		try {
			// Always generate a unique ID for OPFS storage
			const opfsFileId = generateTrackId();

			console.log("loadAudioFileAtom called:", { existingTrackId, opfsFileId });

			// Load audio file through MediaBunny
			const audioInfo = await audioManager.loadAudioFile(file, opfsFileId);

			if (existingTrackId) {
				// Update existing track with audio data
				const tracks = get(tracksAtom);
				const existingTrack = tracks.find((t) => t.id === existingTrackId);

				if (existingTrack) {
					// Update the existing track
					const updatedTrack: Track = {
						...existingTrack,
						name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
						duration: audioInfo.duration * 1000, // Convert to ms
						trimStart: 0,
						trimEnd: audioInfo.duration * 1000,
						opfsFileId: opfsFileId,
						audioFileName: audioInfo.fileName,
						audioFileType: audioInfo.fileType,
					};

					console.log(
						"Updated existing track:",
						updatedTrack.id,
						"with opfsFileId:",
						updatedTrack.opfsFileId,
					);
					set(
						tracksAtom,
						tracks.map((t) => (t.id === existingTrackId ? updatedTrack : t)),
					);
					return updatedTrack;
				}
			}

			// Create new track with audio information
			const newTrackId = generateTrackId();
			const newTrack: Track = {
				id: newTrackId,
				name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
				duration: audioInfo.duration * 1000, // Convert to ms
				startTime: 0,
				trimStart: 0,
				trimEnd: audioInfo.duration * 1000,
				volume: 75,
				muted: false,
				soloed: false,
				color: "#3b82f6", // Default blue
				opfsFileId: opfsFileId,
				audioFileName: audioInfo.fileName,
				audioFileType: audioInfo.fileType,
			};

			console.log(
				"Created new track:",
				newTrackId,
				"with opfsFileId:",
				opfsFileId,
			);

			// Add track to state
			const tracks = get(tracksAtom);
			set(tracksAtom, [...tracks, newTrack]);

			return newTrack;
		} catch (error) {
			console.error("Failed to load audio file:", error);
			throw error;
		}
	},
);

// Enhanced playback control with audio integration
export const togglePlaybackAtom = atom(null, async (get, set) => {
	const playback = get(playbackAtom);
	const tracks = get(tracksAtom);

	console.log("Toggle playback called:", {
		isPlaying: playback.isPlaying,
		tracksCount: tracks.length,
	});

	if (playback.isPlaying) {
		// Pause playback
		await playbackEngine.pause();
		set(playbackAtom, { ...playback, isPlaying: false });
		console.log("Playback paused");
	} else {
		// Start/resume playback from current position
		const currentTime = playback.currentTime / 1000; // Convert to seconds

		console.log(
			"Starting playback with tracks:",
			tracks.map((t) => ({
				id: t.id,
				name: t.name,
				hasOpfsFile: !!t.opfsFileId,
				duration: t.duration,
				muted: t.muted,
			})),
		);

		// Initialize engine with current tracks
		await playbackEngine.initializeWithTracks(tracks);

		await playbackEngine.play(tracks, {
			startTime: currentTime,
			onTimeUpdate: (time) => {
				// Update time without triggering seek
				const playback = get(playbackAtom);
				set(playbackAtom, { ...playback, currentTime: time * 1000 });
			},
			onPlaybackEnd: () => {
				const endPlayback = get(playbackAtom);
				set(playbackAtom, { ...endPlayback, isPlaying: false });
				console.log("Playback ended");
			},
		});

		set(playbackAtom, { ...playback, isPlaying: true });
		console.log("Playback started");
	}
});

export const stopPlaybackAtom = atom(null, async (get, set) => {
	await playbackEngine.stop();
	const playback = get(playbackAtom);
	set(playbackAtom, {
		...playback,
		isPlaying: false,
		// Keep current time where it is - don't reset to 0
	});
});

export const setTimelineScrollAtom = atom(
	null,
	(get, set, scrollPosition: number) => {
		const timeline = get(timelineAtom);
		set(timelineAtom, { ...timeline, scrollPosition });
	},
);

// Scroll position atoms for unified scroll management
export const horizontalScrollAtom = atom<number>(0);
export const verticalScrollAtom = atom<number>(0);

// Mutator for BPM (used by controls)
export const setBpmAtom = atom(null, (get, set, bpm: number) => {
	const playback = get(playbackAtom);
	const clamped = Math.max(30, Math.min(300, Number.isFinite(bpm) ? bpm : 120));
	set(playbackAtom, { ...playback, bpm: clamped });
});
