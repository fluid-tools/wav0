"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { audioManager } from "@/lib/audio/audio-manager";
import { playbackEngine } from "@/lib/audio/playback-engine";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import { generateTrackId } from "@/lib/storage/opfs";

export type Clip = {
	id: string;
	name: string;
	opfsFileId: string;
	audioFileName?: string;
	audioFileType?: string;
	// Timeline positioning (absolute, in ms)
	startTime: number;
	// File region in ms
	trimStart: number;
	trimEnd: number;
	// Original source duration in ms (for clamping)
	sourceDurationMs: number;
	// Optional fade envelopes (ms)
	fadeIn?: number;
	fadeOut?: number;
	// Loop clip content continuously (seamless). When true, clip repeats.
	loop?: boolean;
	// Optional loop end time in ms (timeline absolute). If unset, no visual extension.
	loopEnd?: number;
	color?: string;
};

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
	// OPFS file reference for persistent storage (legacy single-clip)
	opfsFileId?: string;
	audioFileName?: string;
	audioFileType?: string;
	// Multiple clips per track (new model)
	clips?: Clip[];
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

export type Tool = "pointer" | "trim" | "razor";

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
	zoom: 0.5, // start wider view by default
	scrollPosition: 0,
	snapToGrid: true,
	gridSize: 500, // 0.5s grid for better granularity
});

export const trackHeightZoomAtom = atom(1.0); // Track height zoom level (1.0 = 100px default)

export const selectedTrackIdAtom = atom<string | null>(null);
export const selectedClipIdAtom = atom<string | null>(null);
export const activeToolAtom = atom<Tool>("pointer");
export const projectNameAtom = atomWithStorage<string>(
	"daw-project-name",
	"Untitled Project",
);

// Clip operations
export const updateClipAtom = atom(
	null,
	async (get, set, trackId: string, clipId: string, updates: Partial<Clip>) => {
		const tracks = get(tracksAtom);
		const playback = get(playbackAtom);
		const updatedTracks = tracks.map((t) => {
			if (t.id !== trackId) return t;
			if (!t.clips) return t;
			return {
				...t,
				clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
			};
		});
		set(tracksAtom, updatedTracks);

		const updatedTrack = updatedTracks.find((t) => t.id === trackId);
		if (!updatedTrack) return;

		// If playing and timing/looping changed, reschedule for immediate correctness
		if (
			playback.isPlaying &&
			(updates.startTime !== undefined ||
				updates.trimStart !== undefined ||
				updates.trimEnd !== undefined ||
				updates.loop !== undefined ||
				updates.loopEnd !== undefined)
		) {
			try {
				await playbackEngine.rescheduleTrack(updatedTrack);
			} catch (e) {
				console.error(
					"Failed to reschedule track after clip update",
					trackId,
					clipId,
					e,
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

	const splitTimeMs = playback.currentTime; // already ms
	// Validate split within clip window
	const clipStartMs = clip.startTime;
	const clipEndMs = clip.startTime + (clip.trimEnd - clip.trimStart);
	if (splitTimeMs <= clipStartMs || splitTimeMs >= clipEndMs) return;

	const offsetInClip = splitTimeMs - clip.startTime; // ms into clip
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
	// Optional small default crossfade
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

	// select the right clip after split
	set(selectedClipIdAtom, newRight.id);

	if (playback.isPlaying) {
		try {
			await playbackEngine.rescheduleTrack(updatedTrack);
		} catch (e) {
			console.error("Failed to reschedule after split", track.id, e);
		}
	}
});

// Derived atoms
export const selectedTrackAtom = atom((get) => {
	const tracks = get(tracksAtom);
	const selectedId = get(selectedTrackIdAtom);
	return tracks.find((track) => track.id === selectedId) || null;
});

// Optional manual project end override
export const projectEndOverrideAtom = atomWithStorage<number | null>(
	"daw-project-end-override",
	null,
);

export const totalDurationAtom = atom((get) => {
	const tracks = get(tracksAtom);
	const override = get(projectEndOverrideAtom);
	// Compute from clips, including loopEnd if present (infinite loops ignored)
	const perTrackEnds = tracks.map((track) => {
		if (track.clips && track.clips.length > 0) {
			const ends = track.clips.map((c) => {
				const oneShotEnd = c.startTime + Math.max(0, c.trimEnd - c.trimStart);
				const loopEnd = c.loop ? (c.loopEnd ?? oneShotEnd) : oneShotEnd;
				return loopEnd;
			});
			return Math.max(...ends, 0);
		}
		return track.startTime + track.duration;
	});
	const tracksDuration = Math.max(...perTrackEnds, 0);
	const minimumDuration = 3 * 60 * 1000; // 3 minutes default canvas
	const computed = Math.max(tracksDuration, minimumDuration);
	return override !== null ? Math.max(override, computed) : computed;
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

		const updatedTrack = updatedTracks.find((t) => t.id === trackId);
		if (!updatedTrack) return;

		// Volume/mute/solo should reflect immediately without reschedule
		if (typeof updates.volume === "number") {
			playbackEngine.updateTrackVolume(trackId, updates.volume);
		}
		if (typeof updates.muted === "boolean") {
			const vol =
				typeof updates.volume === "number"
					? updates.volume
					: updatedTrack.volume;
			playbackEngine.updateTrackMute(trackId, updates.muted, vol);
		}
		if (typeof updates.soloed === "boolean") {
			playbackEngine.updateSoloStates(updatedTracks);
		}

		// If playing and timing changed, reschedule for immediate correctness
		if (
			playback.isPlaying &&
			(updates.startTime !== undefined ||
				updates.trimStart !== undefined ||
				updates.trimEnd !== undefined)
		) {
			try {
				await playbackEngine.rescheduleTrack(updatedTrack);
			} catch (e) {
				console.error("Failed to reschedule track after update", trackId, e);
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
				// Restart at end-of-project if we cross it
				const total = get(totalDurationAtom);
				const ms = currentTime * 1000;
				if (ms >= total) {
					set(playbackAtom, {
						...newPlayback,
						currentTime: 0,
						isPlaying: false,
					});
					return;
				}
				set(playbackAtom, { ...newPlayback, currentTime: ms });
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
	async (
		get,
		set,
		file: File,
		existingTrackId?: string,
		opts?: { startTimeMs?: number },
	) => {
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
					// Update the existing track (legacy fields) AND append a new clip
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
						color: existingTrack.color,
					};

					const updatedTrack: Track = {
						...existingTrack,
						name: file.name.replace(/\.[^/.]+$/, ""),
						duration: audioInfo.duration * 1000,
						trimStart: 0,
						trimEnd: audioInfo.duration * 1000,
						opfsFileId,
						audioFileName: audioInfo.fileName,
						audioFileType: audioInfo.fileType,
						clips: [
							...(existingTrack.clips ?? []),
							{ ...clip, sourceDurationMs: audioInfo.duration * 1000 },
						],
					};

					set(
						tracksAtom,
						tracks.map((t) => (t.id === existingTrackId ? updatedTrack : t)),
					);

					// If we are playing, immediately reschedule this track to reflect the new clip
					const playback = get(playbackAtom);
					if (playback.isPlaying) {
						try {
							await playbackEngine.rescheduleTrack(updatedTrack);
						} catch (e) {
							console.error(
								"Failed to reschedule after adding clip",
								existingTrackId,
								e,
							);
						}
					}

					return updatedTrack;
				}
			}

			// Create new track with audio information and a single clip
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
				color: "#3b82f6",
			};
			const newTrack: Track = {
				id: newTrackId,
				name: file.name.replace(/\.[^/.]+$/, ""),
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

			const tracks2 = get(tracksAtom);
			set(tracksAtom, [...tracks2, newTrack]);

			// If playing, reschedule this new track so it joins playback immediately
			const playback = get(playbackAtom);
			if (playback.isPlaying) {
				try {
					await playbackEngine.rescheduleTrack(newTrack);
				} catch (e) {
					console.error(
						"Failed to reschedule after creating track",
						newTrackId,
						e,
					);
				}
			}

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
				// Update time and restart when crossing project end
				const playback = get(playbackAtom);
				const total = get(totalDurationAtom);
				const ms = time * 1000;
				if (ms >= total) {
					set(playbackAtom, { ...playback, currentTime: 0, isPlaying: false });
					return;
				}
				set(playbackAtom, { ...playback, currentTime: ms });
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
