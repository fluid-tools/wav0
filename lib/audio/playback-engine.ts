"use client";

import type { Track } from "@/lib/state/daw-store";
import { audioManager } from "./audio-manager";

export interface PlaybackOptions {
	startTime?: number;
	looping?: boolean;
	onTimeUpdate?: (currentTime: number) => void;
	onPlaybackEnd?: () => void;
}

export interface TrackPlaybackState {
	source: AudioBufferSourceNode | null;
	gainNode: GainNode | null;
	isPlaying: boolean;
	startedAt: number;
	pausedAt: number;
	offset: number;
}

/**
 * PlaybackEngine handles synchronized multi-track audio playback
 * Integrates with DAW timeline and controls
 */
export class PlaybackEngine {
	private static instance: PlaybackEngine;

	private audioContext: AudioContext | null = null;
	private masterGainNode: GainNode | null = null;
	private isPlaying = false;
	private startTime = 0;
	private pausedTime = 0;
	private currentTime = 0;
	private tracks = new Map<string, TrackPlaybackState>();
	private animationFrameId: number | null = null;

	// Playback options
	private options: PlaybackOptions = {};

	private constructor() {}

	static getInstance(): PlaybackEngine {
		if (!PlaybackEngine.instance) {
			PlaybackEngine.instance = new PlaybackEngine();
		}
		return PlaybackEngine.instance;
	}

	private async getAudioContext(): Promise<AudioContext> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext();

			// Create master gain node for overall volume control
			this.masterGainNode = this.audioContext.createGain();
			this.masterGainNode.connect(this.audioContext.destination);

			// Resume context if suspended
			if (this.audioContext.state === "suspended") {
				await this.audioContext.resume();
			}
		}
		return this.audioContext;
	}

	/**
	 * Initialize playback engine with tracks
	 */
	async initializeWithTracks(tracks: Track[]): Promise<void> {
		await this.getAudioContext();

		console.log('Initializing playback engine with tracks:', tracks.length);

		// Clear existing tracks
		this.tracks.clear();

		// Initialize each track that has audio
		for (const track of tracks) {
			if (track.opfsFileId) {
				console.log('Initializing track:', track.name, 'with opfsFileId:', track.opfsFileId);
				this.tracks.set(track.id, {
					source: null,
					gainNode: null,
					isPlaying: false,
					startedAt: 0,
					pausedAt: 0,
					offset: 0,
				});
			} else {
				console.log('Skipping track without audio:', track.name);
			}
		}

		console.log('Playback engine initialized with', this.tracks.size, 'audio tracks');
	}

	/**
	 * Start playback from specified time
	 */
	async play(tracks: Track[], options: PlaybackOptions = {}): Promise<void> {
		this.options = options;

		if (this.isPlaying) {
			await this.stop();
		}

		await this.getAudioContext();
		if (!this.audioContext || !this.masterGainNode) {
			throw new Error("AudioContext not initialized");
		}
		const audioContext = this.audioContext;
		const masterGain = this.masterGainNode;

		// Calculate start time
		const startOffset = options.startTime || this.pausedTime;
		this.startTime = audioContext.currentTime;
		this.pausedTime = 0;
		this.isPlaying = true;

		// Start each track
		for (const track of tracks) {
			console.log('Processing track for playback:', {
				name: track.name,
				hasOpfsFileId: !!track.opfsFileId,
				muted: track.muted,
				volume: track.volume
			});

			if (!track.opfsFileId || track.muted) {
				console.log('Skipping track:', track.name, 'opfsFileId:', !!track.opfsFileId, 'muted:', track.muted);
				continue;
			}

			const trackState = this.tracks.get(track.id);
			if (!trackState) {
				console.log('No track state found for:', track.name);
				continue;
			}

			try {
				// Get audio buffer for the track
				console.log('Getting audio buffer for track:', track.name, 'opfsFileId:', track.opfsFileId);
				const audioBuffer = await audioManager.getAudioBuffer(track.opfsFileId);
				if (!audioBuffer) {
					console.log('No audio buffer returned for track:', track.name);
					continue;
				}
				
				console.log('Audio buffer loaded for track:', track.name, 'duration:', audioBuffer.duration, 'channels:', audioBuffer.numberOfChannels);

				// Create audio source and gain for this track
				const source = audioContext.createBufferSource();
				const gainNode = audioContext.createGain();

				source.buffer = audioBuffer;

				// Set track volume (0-100 to 0-1, with additional scaling if soloed)
				const hasAnyTracksInSolo = tracks.some((t) => t.soloed);
				let volume = track.volume / 100;

				if (hasAnyTracksInSolo) {
					volume = track.soloed ? volume : 0; // Mute non-soloed tracks when any track is soloed
				}

				gainNode.gain.value = volume;

				// Connect audio graph: source -> track gain -> master gain -> destination
				source.connect(gainNode);
				gainNode.connect(masterGain);

				// Calculate timing based on track position in timeline
				const trackStartTime = track.startTime / 1000; // Convert ms to seconds
				const trackTrimStart = track.trimStart / 1000;
				const audioOffset =
					Math.max(0, startOffset - trackStartTime) + trackTrimStart;
				const playStartTime = Math.max(
					this.startTime,
					this.startTime + (trackStartTime - startOffset),
				);

				// Only play if the track should be audible at the start time
				if (startOffset < trackStartTime + track.duration / 1000) {
					const playDuration = (track.trimEnd - track.trimStart) / 1000;
					
					console.log('Starting audio source for track:', track.name, {
						playStartTime,
						audioOffset,
						playDuration,
						startOffset,
						trackStartTime
					});
					
					source.start(playStartTime, audioOffset, playDuration);

					// Store track state
					trackState.source = source;
					trackState.gainNode = gainNode;
					trackState.isPlaying = true;
					trackState.startedAt = playStartTime;
					trackState.offset = audioOffset;

					console.log('Audio source started successfully for track:', track.name);

					// Handle track end
					source.onended = () => {
						console.log('Audio source ended for track:', track.name);
						if (trackState.source === source) {
							trackState.isPlaying = false;
							trackState.source = null;
							trackState.gainNode = null;
						}
					};
				} else {
					console.log('Track not audible at start time:', track.name, 'startOffset:', startOffset, 'trackEnd:', trackStartTime + track.duration / 1000);
				}
			} catch (error) {
				console.error(`Failed to start playback for track ${track.id}:`, error);
			}
		}

		// Start time update loop
		this.startTimeUpdateLoop();
	}

	/**
	 * Pause playback
	 */
	async pause(): Promise<void> {
		if (!this.isPlaying) return;

		this.isPlaying = false;
		this.pausedTime = this.getCurrentTime();

		// Stop all tracks
		for (const trackState of this.tracks.values()) {
			if (trackState.source) {
				try {
					trackState.source.stop();
				} catch {
					// Source might already be stopped
				}
				trackState.source = null;
				trackState.gainNode = null;
				trackState.isPlaying = false;
			}
		}

		// Stop time update loop
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	/**
	 * Stop playback and reset to beginning
	 */
	async stop(): Promise<void> {
		await this.pause();
		this.pausedTime = 0;
		this.currentTime = 0;

		if (this.options.onTimeUpdate) {
			this.options.onTimeUpdate(0);
		}
	}

	/**
	 * Seek to specific time
	 */
	async seek(time: number): Promise<void> {
		const wasPlaying = this.isPlaying;

		if (wasPlaying) {
			await this.pause();
		}

		this.pausedTime = time;
		this.currentTime = time;

		if (this.options.onTimeUpdate) {
			this.options.onTimeUpdate(time);
		}

		// If was playing, resume from new position
		if (wasPlaying) {
			// We need the current tracks to restart playback
			// This requires the calling code to pass tracks again
			// For now, we'll just update the time
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
	 * Update track mute state in real-time
	 */
	updateTrackMute(trackId: string, muted: boolean): void {
		const trackState = this.tracks.get(trackId);
		if (trackState?.gainNode) {
			trackState.gainNode.gain.value = muted ? 0 : 1; // Simple mute implementation
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
	 * Get current playback time
	 */
	getCurrentTime(): number {
		if (!this.isPlaying) {
			return this.pausedTime;
		}

		if (!this.audioContext) {
			return 0;
		}

		return this.pausedTime + (this.audioContext.currentTime - this.startTime);
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

			this.currentTime = this.getCurrentTime();

			if (this.options.onTimeUpdate) {
				this.options.onTimeUpdate(this.currentTime);
			}

			this.animationFrameId = requestAnimationFrame(updateTime);
		};

		updateTime();
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		await this.stop();

		if (this.audioContext) {
			await this.audioContext.close();
			this.audioContext = null;
			this.masterGainNode = null;
		}

		this.tracks.clear();
	}
}

// Export singleton instance
export const playbackEngine = PlaybackEngine.getInstance();
