"use client";

import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type InputAudioTrack,
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
	audioTrack: InputAudioTrack;
	sink: AudioBufferSink;
	input: Input;
	info: AudioFileInfo;
}

/**
 * AudioManager handles MediaBunny instances and provides proper state management
 * Based on MediaBunny player implementation patterns
 */
export class AudioManager {
	private static instance: AudioManager;
	private audioContext: AudioContext | null = null;
	private loadedTracks = new Map<string, LoadedAudioTrack>();

	private constructor() {}

	static getInstance(): AudioManager {
		if (!AudioManager.instance) {
			AudioManager.instance = new AudioManager();
		}
		return AudioManager.instance;
	}

	async getAudioContext(): Promise<AudioContext> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext();

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

			// Check if track can be decoded
			const canDecode = await audioTrack.canDecode();
			if (!canDecode) {
				throw new Error("Audio track cannot be decoded");
			}

			// Create AudioBufferSink for Web Audio API integration
			const sink = new AudioBufferSink(audioTrack);

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

			// Store loaded track globally - this is key for state management
			console.log('Storing loaded track with trackId:', trackId);
			this.loadedTracks.set(trackId, {
				audioTrack,
				sink,
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

			// Check if track can be decoded
			const canDecode = await audioTrack.canDecode();
			if (!canDecode) {
				throw new Error("Stored audio track cannot be decoded");
			}

			// Create AudioBufferSink
			const sink = new AudioBufferSink(audioTrack);

			const duration = await audioTrack.computeDuration();
			const info: AudioFileInfo = {
				duration,
				sampleRate: audioTrack.sampleRate,
				numberOfChannels: audioTrack.numberOfChannels,
				codec: audioTrack.codec,
				fileName,
				fileType: "", // We don't store file type in OPFS filename
			};

			// Store globally
			this.loadedTracks.set(trackId, {
				audioTrack,
				sink,
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
	 * Get the AudioBufferSink for a track - this is the key for proper MediaBunny usage
	 */
	getAudioBufferSink(trackId: string): AudioBufferSink | null {
		const loadedTrack = this.loadedTracks.get(trackId);
		return loadedTrack ? loadedTrack.sink : null;
	}

	/**
	 * Get track info
	 */
	getTrackInfo(trackId: string): AudioFileInfo | null {
		const loadedTrack = this.loadedTracks.get(trackId);
		return loadedTrack ? loadedTrack.info : null;
	}

	/**
	 * Check if track is loaded
	 */
	isTrackLoaded(trackId: string): boolean {
		return this.loadedTracks.has(trackId);
	}

	/**
	 * Unload a track and free resources
	 */
	unloadTrack(trackId: string): void {
		const loadedTrack = this.loadedTracks.get(trackId);
		if (loadedTrack) {
			// MediaBunny handles cleanup automatically
			this.loadedTracks.delete(trackId);
		}
	}

	/**
	 * Clean up all loaded tracks and audio context
	 */
	cleanup(): void {
		this.loadedTracks.clear();
		if (this.audioContext) {
			this.audioContext.close();
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
		this.unloadTrack(trackId);
	}
}

export const audioManager = AudioManager.getInstance();