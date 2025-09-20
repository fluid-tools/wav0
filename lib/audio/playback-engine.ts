"use client";

import type { Track } from "@/lib/state/daw-store";
import { audioManager } from "./audio-manager";

export interface PlaybackOptions {
	startTime?: number;
	onTimeUpdate?: (time: number) => void;
	onPlaybackEnd?: () => void;
}

type TrackPlaybackState = {
	iterator: AsyncIterableIterator<{
		buffer: AudioBuffer;
		timestamp: number;
	}> | null;
	audioSources: AudioBufferSourceNode[];
	gainNode: GainNode | null;
	isPlaying: boolean;
};

/**
 * PlaybackEngine based on MediaBunny player implementation pattern
 * Key insight: Use the global AudioBufferSink instances and proper timing
 */
export class PlaybackEngine {
	private static instance: PlaybackEngine;
	private audioContext: AudioContext | null = null;
	private masterGainNode: GainNode | null = null;
	private tracks = new Map<string, TrackPlaybackState>();
	private isPlaying = false;
	private startTime = 0;
	private playbackTimeAtStart = 0;
	private options: PlaybackOptions = {};
	private animationFrameId: number | null = null;
	private queuedAudioNodes = new Set<AudioBufferSourceNode>();

	private constructor() {}

	static getInstance(): PlaybackEngine {
		if (!PlaybackEngine.instance) {
			PlaybackEngine.instance = new PlaybackEngine();
		}
		return PlaybackEngine.instance;
	}

	private async getAudioContext(): Promise<AudioContext> {
		if (!this.audioContext) {
			this.audioContext = await audioManager.getAudioContext();
			this.masterGainNode = this.audioContext.createGain();
			this.masterGainNode.connect(this.audioContext.destination);
		}
		return this.audioContext;
	}

	/**
	 * Get current playback time like MediaBunny player
	 */
	private getPlaybackTime(): number {
		if (this.isPlaying && this.audioContext) {
			return (
				this.audioContext.currentTime -
				this.startTime +
				this.playbackTimeAtStart
			);
		} else {
			return this.playbackTimeAtStart;
		}
	}

	/**
	 * Initialize playback engine with tracks
	 */
	async initializeWithTracks(tracks: Track[]): Promise<void> {
		await this.getAudioContext();

		console.log("Initializing playback engine with tracks:", tracks.length);

		// Clear existing tracks
		this.tracks.clear();

		// Initialize each track that has audio
		for (const track of tracks) {
			if (track.opfsFileId && audioManager.isTrackLoaded(track.opfsFileId)) {
				console.log(
					"Initializing track:",
					track.name,
					"with opfsFileId:",
					track.opfsFileId,
				);
				this.tracks.set(track.id, {
					iterator: null,
					audioSources: [],
					gainNode: null,
					isPlaying: false,
				});
			} else {
				console.log("Skipping track without loaded audio:", track.name);
			}
		}

		console.log(
			"Playback engine initialized with",
			this.tracks.size,
			"audio tracks",
		);
	}

	/**
	 * Start playback from specified time - based on MediaBunny player pattern
	 */
	async play(tracks: Track[], options: PlaybackOptions = {}): Promise<void> {
		this.options = options;

		if (this.isPlaying) {
			await this.pause();
		}

		await this.getAudioContext();
		if (!this.audioContext || !this.masterGainNode) {
			throw new Error("AudioContext not initialized");
		}

		// Set playback time like MediaBunny player
		this.playbackTimeAtStart = options.startTime || 0;
		this.startTime = this.audioContext.currentTime;
		this.isPlaying = true;

		console.log("Starting playback from time:", this.playbackTimeAtStart);

		// Start each track
		for (const track of tracks) {
			if (!track.opfsFileId || track.muted) {
				continue;
			}

			const trackState = this.tracks.get(track.id);
			if (!trackState) {
				continue;
			}

			try {
				// Get the AudioBufferSink from AudioManager
				const sink = audioManager.getAudioBufferSink(track.opfsFileId);
				if (!sink) {
					console.log("No AudioBufferSink found for track:", track.name);
					continue;
				}

				// Create gain node for this track
				const gainNode = this.audioContext.createGain();

				// Set track volume (handle solo logic)
				const hasAnyTracksInSolo = tracks.some((t) => t.soloed);
				let volume = track.volume / 100;

				if (hasAnyTracksInSolo) {
					volume = track.soloed ? volume : 0;
				}

				gainNode.gain.value = volume;
				gainNode.connect(this.masterGainNode);
				trackState.gainNode = gainNode;

				// Track timing calculations
				const trackStartTime = track.startTime / 1000; // Track position in timeline (seconds)
				const trimStart = track.trimStart / 1000; // Start of trimmed section in original file (seconds)
				const trimEnd = track.trimEnd / 1000; // End of trimmed section in original file (seconds)

				// Calculate track's end time in timeline
				const trackEndTime = trackStartTime + (trimEnd - trimStart);

				// Only skip if playback starts after the track has fully ended
				if (this.playbackTimeAtStart >= trackEndTime) {
					console.log(
						"Track is completely past playback start, skipping:",
						track.name,
						{
							playbackTime: this.playbackTimeAtStart,
							trackStart: trackStartTime,
							trackEnd: trackEndTime,
						},
					);
					continue;
				}

				// Calculate where to start reading in the original audio file
				// If playback starts before the track, begin at the start of the trimmed audio
				const timeIntoTrackRaw = this.playbackTimeAtStart - trackStartTime; // may be negative
				const timeIntoTrack = Math.max(0, timeIntoTrackRaw); // clamp to 0 for future-starting tracks
				const audioFileReadStart = trimStart + timeIntoTrack; // Corresponding position in original file

				// Don't read past the trim end
				if (audioFileReadStart >= trimEnd) {
					console.log("Audio read start past trim end:", track.name);
					continue;
				}

				console.log("Starting MediaBunny iteration for track:", track.name, {
					trackStartTime,
					trimStart,
					trimEnd,
					timeIntoTrack,
					audioFileReadStart,
					playbackTime: this.playbackTimeAtStart,
				});

				// MediaBunny: buffers(start, end) reads from original file timestamps
				const iterator = sink.buffers(audioFileReadStart, trimEnd);
				trackState.iterator = iterator;
				trackState.isPlaying = true;

				// Start the audio iterator for this track
				this.runTrackAudioIterator(
					track,
					trackState,
					trackStartTime,
					trimStart,
				);
			} catch (error) {
				console.error(`Failed to start playback for track ${track.id}:`, error);
			}
		}

		// Start time update loop
		this.startTimeUpdateLoop();
	}

	/**
	 * Run audio iterator for a track - properly map original file timestamps to timeline
	 */
	private async runTrackAudioIterator(
		track: Track,
		trackState: TrackPlaybackState,
		trackStartTime: number,
		trimStart: number,
	): Promise<void> {
		if (!trackState.iterator || !trackState.gainNode || !this.audioContext)
			return;

		try {
			for await (const { buffer, timestamp } of trackState.iterator) {
				if (!this.isPlaying || !trackState.isPlaying) {
					break;
				}

				console.log("Playing audio buffer for track:", track.name, {
					originalFileTimestamp: timestamp,
					duration: buffer.duration,
					trimStart,
					trackStartTime,
				});

				// Create audio source
				const node = this.audioContext.createBufferSource();
				node.buffer = buffer;
				node.connect(trackState.gainNode);

				// Map original file timestamp to timeline position
				// timestamp is from the original file, we need to convert to timeline
				const timeInTrimmedAudio = timestamp - trimStart; // How far into the trimmed section
				const timelinePosition = trackStartTime + timeInTrimmedAudio; // Where this should play in timeline
				const audioContextStartTime =
					this.startTime + timelinePosition - this.playbackTimeAtStart;

				console.log("Audio timing calculation:", {
					originalFileTimestamp: timestamp,
					timeInTrimmedAudio,
					timelinePosition,
					audioContextStartTime,
					currentAudioTime: this.audioContext.currentTime,
				});

				if (audioContextStartTime >= this.audioContext.currentTime) {
					node.start(audioContextStartTime);
				} else {
					// We're late, start immediately with offset
					const offset = this.audioContext.currentTime - audioContextStartTime;
					if (offset < buffer.duration) {
						node.start(this.audioContext.currentTime, offset);
					} else {
						// Skip this buffer - we're too late
						console.log(
							"Skipping buffer - too late:",
							offset,
							"vs",
							buffer.duration,
						);
						continue;
					}
				}

				trackState.audioSources.push(node);
				this.queuedAudioNodes.add(node);

				node.onended = () => {
					const index = trackState.audioSources.indexOf(node);
					if (index > -1) {
						trackState.audioSources.splice(index, 1);
					}
					this.queuedAudioNodes.delete(node);
				};

				// Buffer ahead control based on timeline position
				const currentTimelineTime = this.getPlaybackTime();
				if (timelinePosition - currentTimelineTime >= 1) {
					await new Promise((resolve) => {
						const id = setInterval(() => {
							if (
								timelinePosition - this.getPlaybackTime() < 1 ||
								!this.isPlaying
							) {
								clearInterval(id);
								resolve(undefined);
							}
						}, 100);
					});
				}
			}
		} catch (iteratorError) {
			console.error(
				"Error in track audio iterator:",
				track.name,
				iteratorError,
			);
		}
	}

	/**
	 * Pause playback - like MediaBunny player
	 */
	async pause(): Promise<void> {
		this.playbackTimeAtStart = this.getPlaybackTime();
		this.isPlaying = false;

		// Stop all iterators
		for (const trackState of this.tracks.values()) {
			trackState.isPlaying = false;
			if (trackState.iterator) {
				await trackState.iterator.return?.(undefined);
				trackState.iterator = null;
			}
		}

		// Stop all audio sources
		for (const node of this.queuedAudioNodes) {
			try {
				node.stop();
			} catch (error) {
				// Node may already be stopped
			}
		}
		this.queuedAudioNodes.clear();

		this.stopTimeUpdateLoop();
	}

	/**
	 * Stop playback and reset to beginning
	 */
	async stop(): Promise<void> {
		await this.pause();
		this.playbackTimeAtStart = 0;

		if (this.options.onTimeUpdate) {
			this.options.onTimeUpdate(0);
		}
	}

	/**
	 * Seek to specific time - restart playback from new position
	 */
	async seek(time: number): Promise<void> {
		const wasPlaying = this.isPlaying;

		if (wasPlaying) {
			await this.pause();
		}

		this.playbackTimeAtStart = time;

		if (this.options.onTimeUpdate) {
			this.options.onTimeUpdate(time);
		}

		// If was playing, restart from new position
		if (wasPlaying) {
			// We need to restart with the current tracks
			// For now, just update the time - the calling code should handle restart
		}
	}

	/**
	 * Get current playback time
	 */
	getCurrentTime(): number {
		return this.getPlaybackTime();
	}

	/**
	 * Check if currently playing
	 */
	getIsPlaying(): boolean {
		return this.isPlaying;
	}

	/**
	 * Start time update loop
	 */
	private startTimeUpdateLoop(): void {
		const updateTime = () => {
			if (!this.isPlaying) return;

			const currentTime = this.getPlaybackTime();

			if (this.options.onTimeUpdate) {
				this.options.onTimeUpdate(currentTime);
			}

			this.animationFrameId = requestAnimationFrame(updateTime);
		};

		updateTime();
	}

	/**
	 * Stop time update loop
	 */
	private stopTimeUpdateLoop(): void {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	/**
	 * Update track volume in real-time
	 */
	updateTrackVolume(trackId: string, volume: number): void {
		const trackState = this.tracks.get(trackId);
		if (trackState?.gainNode) {
			trackState.gainNode.gain.value = volume / 100;
		}
	}

	/**
	 * Update track mute state
	 */
	updateTrackMute(trackId: string, muted: boolean): void {
		const trackState = this.tracks.get(trackId);
		if (trackState?.gainNode) {
			trackState.gainNode.gain.value = muted ? 0 : 1;
		}
	}

	/**
	 * Update master volume
	 */
	updateMasterVolume(volume: number): void {
		if (this.masterGainNode) {
			this.masterGainNode.gain.value = volume / 100;
		}
	}

	/**
	 * Clean up all resources
	 */
	cleanup(): void {
		this.stop();
		this.tracks.clear();

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
			this.masterGainNode = null;
		}
	}
}

export const playbackEngine = PlaybackEngine.getInstance();
