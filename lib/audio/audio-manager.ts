"use client";

import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type InputAudioTrack,
	type WrappedAudioBuffer,
} from "mediabunny";
import { opfsManager } from "@/lib/storage/opfs";

export interface AudioFileInfo {
	duration: number;
	sampleRate: number;
	numberOfChannels: number;
	codec: string | null;
	fileName: string;
	fileType: string;
}

export interface LoadedAudioTrack {
	track: InputAudioTrack;
	input: Input;
	info: AudioFileInfo;
}

/**
 * AudioManager handles audio file loading, processing, and playback using MediaBunny and OPFS
 * Provides a unified interface for DAW audio operations
 */
export class AudioManager {
	private static instance: AudioManager;
	private audioContext: AudioContext | null = null;
	private loadedTracks = new Map<string, LoadedAudioTrack>();
	private audioBufferCache = new Map<string, AudioBuffer>();

	private constructor() {}

	static getInstance(): AudioManager {
		if (!AudioManager.instance) {
			AudioManager.instance = new AudioManager();
		}
		return AudioManager.instance;
	}

	private async getAudioContext(): Promise<AudioContext> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext();

			// Resume context if it's suspended (required by browser autoplay policies)
			if (this.audioContext.state === "suspended") {
				await this.audioContext.resume();
			}
		}
		return this.audioContext;
	}

	/**
	 * Load audio file and save to OPFS, return track info for DAW integration
	 */
	async loadAudioFile(file: File, trackId: string): Promise<AudioFileInfo> {
		try {
			console.log('AudioManager.loadAudioFile called with trackId:', trackId);

			// Create MediaBunny input from file
			const input = new Input({
				source: new BlobSource(file),
				formats: ALL_FORMATS,
			});

			// Get audio track
			const audioTrack = await input.getPrimaryAudioTrack();
			if (!audioTrack) {
				throw new Error("No audio track found in file");
			}

			// Extract audio information
			const duration = await audioTrack.computeDuration();
			const info: AudioFileInfo = {
				duration,
				sampleRate: audioTrack.sampleRate,
				numberOfChannels: audioTrack.numberOfChannels,
				codec: audioTrack.codec,
				fileName: file.name,
				fileType: file.type,
			};

			// Store in cache for immediate use
			console.log('Storing loaded track with trackId:', trackId);
			this.loadedTracks.set(trackId, {
				track: audioTrack,
				input,
				info,
			});

			console.log('Loaded tracks now contains:', Array.from(this.loadedTracks.keys()));

			// Save original file to OPFS for persistence
			const arrayBuffer = await file.arrayBuffer();
			await opfsManager.saveAudioFile(trackId, arrayBuffer);

			console.log('Audio file loaded and cached successfully for trackId:', trackId);
			return info;
		} catch (error) {
			console.error("Failed to load audio file:", error);
			throw new Error(
				`Failed to load audio file: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Load audio track from OPFS by track ID
	 */
	async loadTrackFromOPFS(
		trackId: string,
		fileName: string,
	): Promise<AudioFileInfo | null> {
		try {
			// Check if already loaded
			if (this.loadedTracks.has(trackId)) {
				const loadedTrack = this.loadedTracks.get(trackId);
				return loadedTrack ? loadedTrack.info : null;
			}

			// Load from OPFS
			const arrayBuffer = await opfsManager.loadAudioFile(trackId);
			if (!arrayBuffer) {
				return null;
			}

			// Create MediaBunny input from buffer
			const input = new Input({
				source: new BlobSource(new Blob([arrayBuffer])),
				formats: ALL_FORMATS,
			});

			const audioTrack = await input.getPrimaryAudioTrack();
			if (!audioTrack) {
				throw new Error("No audio track found in stored file");
			}

			const duration = await audioTrack.computeDuration();
			const info: AudioFileInfo = {
				duration,
				sampleRate: audioTrack.sampleRate,
				numberOfChannels: audioTrack.numberOfChannels,
				codec: audioTrack.codec,
				fileName,
				fileType: "", // We don't store file type in OPFS filename
			};

			this.loadedTracks.set(trackId, {
				track: audioTrack,
				input,
				info,
			});

			return info;
		} catch (error) {
			console.error("Failed to load track from OPFS:", error);
			return null;
		}
	}

	/**
	 * Get audio buffer for Web Audio API playback
	 */
	async getAudioBuffer(trackId: string): Promise<AudioBuffer | null> {
		try {
			console.log('getAudioBuffer called for trackId:', trackId);
			console.log('Available cached buffers:', Array.from(this.audioBufferCache.keys()));
			console.log('Available loaded tracks:', Array.from(this.loadedTracks.keys()));

			// Check cache first
			const cachedBuffer = this.audioBufferCache.get(trackId);
			if (cachedBuffer) {
				console.log('Returning cached buffer for trackId:', trackId);
				return cachedBuffer;
			}

			const loadedTrack = this.loadedTracks.get(trackId);
			if (!loadedTrack) {
				console.log('No loaded track found for trackId:', trackId);
				return null;
			}

			console.log('Creating audio buffer for trackId:', trackId);

			// Use MediaBunny's AudioBufferSink for efficient conversion
			const sink = new AudioBufferSink(loadedTrack.track);
			const audioContext = await this.getAudioContext();

			// Get audio buffers for the entire track
			const buffers: WrappedAudioBuffer[] = [];
			for await (const wrappedBuffer of sink.buffers()) {
				buffers.push(wrappedBuffer);
			}

			if (buffers.length === 0) {
				return null;
			}

			// If we have multiple buffers, we need to concatenate them
			if (buffers.length === 1) {
				const audioBuffer = buffers[0].buffer;
				this.audioBufferCache.set(trackId, audioBuffer);
				return audioBuffer;
			}

			// Concatenate multiple buffers
			const totalLength = buffers.reduce((sum, b) => sum + b.buffer.length, 0);
			const sampleRate = buffers[0].buffer.sampleRate;
			const numberOfChannels = buffers[0].buffer.numberOfChannels;

			const concatenatedBuffer = audioContext.createBuffer(
				numberOfChannels,
				totalLength,
				sampleRate,
			);

			let offset = 0;
			for (const wrappedBuffer of buffers) {
				for (let channel = 0; channel < numberOfChannels; channel++) {
					const channelData = wrappedBuffer.buffer.getChannelData(channel);
					concatenatedBuffer.getChannelData(channel).set(channelData, offset);
				}
				offset += wrappedBuffer.buffer.length;
			}

			this.audioBufferCache.set(trackId, concatenatedBuffer);
			return concatenatedBuffer;
		} catch (error) {
			console.error("Failed to get audio buffer:", error);
			return null;
		}
	}

	/**
	 * Get audio samples at specific timestamp using MediaBunny's precise seeking
	 */
	async getAudioSampleAt(
		trackId: string,
		timestamp: number,
	): Promise<AudioBuffer | null> {
		try {
			const loadedTrack = this.loadedTracks.get(trackId);
			if (!loadedTrack) {
				return null;
			}

			const sink = new AudioBufferSink(loadedTrack.track);
			const wrappedBuffer = await sink.getBuffer(timestamp);

			return wrappedBuffer ? wrappedBuffer.buffer : null;
		} catch (error) {
			console.error("Failed to get audio sample at timestamp:", error);
			return null;
		}
	}

	/**
	 * Play audio buffer using Web Audio API
	 */
	async playAudioBuffer(
		audioBuffer: AudioBuffer,
		startTime?: number,
		duration?: number,
		volume: number = 1.0,
	): Promise<AudioBufferSourceNode> {
		const audioContext = await this.getAudioContext();
		const source = audioContext.createBufferSource();
		const gainNode = audioContext.createGain();

		source.buffer = audioBuffer;
		gainNode.gain.value = volume;

		source.connect(gainNode);
		gainNode.connect(audioContext.destination);

		const when = audioContext.currentTime + (startTime || 0);
		const offset = 0;
		const dur = duration || audioBuffer.duration;

		source.start(when, offset, dur);

		return source;
	}

	/**
	 * Create audio source for real-time playback with precise timing
	 */
	async createPlaybackSource(trackId: string): Promise<{
		play: (
			when: number,
			offset: number,
			duration?: number,
			volume?: number,
		) => AudioBufferSourceNode | null;
		getInfo: () => AudioFileInfo | null;
	}> {
		const audioBuffer = await this.getAudioBuffer(trackId);
		const info = this.loadedTracks.get(trackId)?.info || null;

		return {
			play: (
				when: number,
				offset: number,
				duration?: number,
				volume: number = 1.0,
			) => {
				if (!audioBuffer) return null;

				try {
					if (!this.audioContext) return null;

					const source = this.audioContext.createBufferSource();
					const gainNode = this.audioContext.createGain();

					source.buffer = audioBuffer;
					gainNode.gain.value = volume;

					source.connect(gainNode);
					if (this.audioContext) {
						gainNode.connect(this.audioContext.destination);
					}

					const playDuration = duration || audioBuffer.duration - offset;
					source.start(when, offset, playDuration);

					return source;
				} catch (error) {
					console.error("Failed to play audio source:", error);
					return null;
				}
			},
			getInfo: () => info,
		};
	}

	/**
	 * Clean up resources for a track
	 */
	async unloadTrack(trackId: string): Promise<void> {
		this.loadedTracks.delete(trackId);
		this.audioBufferCache.delete(trackId);
	}

	/**
	 * Clean up all resources
	 */
	async cleanup(): Promise<void> {
		this.loadedTracks.clear();
		this.audioBufferCache.clear();

		if (this.audioContext) {
			await this.audioContext.close();
			this.audioContext = null;
		}
	}

	/**
	 * Get list of available tracks from OPFS
	 */
	async getAvailableTracksFromOPFS(): Promise<string[]> {
		return await opfsManager.listAudioFiles();
	}

	/**
	 * Delete track from OPFS
	 */
	async deleteTrackFromOPFS(trackId: string): Promise<void> {
		await opfsManager.deleteAudioFile(trackId);
		await this.unloadTrack(trackId);
	}
}

// Export singleton instance
export const audioManager = AudioManager.getInstance();
