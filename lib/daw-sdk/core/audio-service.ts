"use client";

import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type InputAudioTrack,
} from "mediabunny";
import { opfsManager } from "../../storage/opfs";
import { type AudioFileInfo, AudioFileInfoSchema } from "../types/schemas";

/**
 * Loaded audio track with MediaBunny references
 */
export interface LoadedAudioTrack {
	audioTrack: InputAudioTrack;
	sink: AudioBufferSink;
	input: Input;
	info: AudioFileInfo;
}

/**
 * AudioService - Core audio file management with MediaBunny
 *
 * Architecture:
 * - Singleton pattern for shared state
 * - Manages MediaBunny instances and OPFS storage
 * - Provides type-safe audio file operations
 * - Maintains audio track registry for playback
 */
export class AudioService {
	private static instance: AudioService;
	private audioContext: AudioContext | null = null;
	private loadedTracks = new Map<string, LoadedAudioTrack>();

	private constructor() {}

	static getInstance(): AudioService {
		if (!AudioService.instance) {
			AudioService.instance = new AudioService();
		}
		return AudioService.instance;
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
	 * Load audio file from browser File object
	 * - Decodes with MediaBunny
	 * - Saves to OPFS for persistence
	 * - Returns validated audio info
	 */
	async loadAudioFile(file: File, trackId: string): Promise<AudioFileInfo> {
		// Create MediaBunny input
		const input = new Input({
			source: new BlobSource(file),
			formats: ALL_FORMATS,
		});

		const audioTrack = await input.getPrimaryAudioTrack();
		if (!audioTrack) {
			throw new Error("No audio track found in file");
		}

		const canDecode = await audioTrack.canDecode();
		if (!canDecode) {
			throw new Error("Audio track cannot be decoded");
		}

		const sink = new AudioBufferSink(audioTrack);
		const duration = await audioTrack.computeDuration();

		const info: AudioFileInfo = {
			duration,
			sampleRate: audioTrack.sampleRate,
			numberOfChannels: audioTrack.numberOfChannels,
			codec: audioTrack.codec,
			fileName: file.name,
			fileType: file.type,
		};

		// Validate with Zod
		AudioFileInfoSchema.parse(info);

		// Store loaded track
		this.loadedTracks.set(trackId, {
			audioTrack,
			sink,
			input,
			info,
		});

		// Persist to OPFS
		const arrayBuffer = await file.arrayBuffer();
		await opfsManager.saveAudioFile(trackId, arrayBuffer);

		return info;
	}

	/**
	 * Load audio track from OPFS by ID
	 */
	async loadTrackFromOPFS(
		trackId: string,
		fileName: string,
	): Promise<AudioFileInfo | null> {
		// Check cache first
		if (this.loadedTracks.has(trackId)) {
			const loadedTrack = this.loadedTracks.get(trackId);
			return loadedTrack ? loadedTrack.info : null;
		}

		// Load from OPFS
		const arrayBuffer = await opfsManager.loadAudioFile(trackId);
		if (!arrayBuffer) {
			return null;
		}

		const input = new Input({
			source: new BlobSource(new Blob([arrayBuffer])),
			formats: ALL_FORMATS,
		});

		const audioTrack = await input.getPrimaryAudioTrack();
		if (!audioTrack) {
			throw new Error("No audio track found in stored file");
		}

		const canDecode = await audioTrack.canDecode();
		if (!canDecode) {
			throw new Error("Stored audio track cannot be decoded");
		}

		const sink = new AudioBufferSink(audioTrack);
		const duration = await audioTrack.computeDuration();

		const info: AudioFileInfo = {
			duration,
			sampleRate: audioTrack.sampleRate,
			numberOfChannels: audioTrack.numberOfChannels,
			codec: audioTrack.codec,
			fileName,
			fileType: "",
		};

		AudioFileInfoSchema.parse(info);

		this.loadedTracks.set(trackId, {
			audioTrack,
			sink,
			input,
			info,
		});

		return info;
	}

	/**
	 * Get AudioBufferSink for playback
	 */
	getAudioBufferSink(trackId: string): AudioBufferSink | null {
		const loadedTrack = this.loadedTracks.get(trackId);
		return loadedTrack ? loadedTrack.sink : null;
	}

	/**
	 * Get track metadata
	 */
	getTrackInfo(trackId: string): AudioFileInfo | null {
		const loadedTrack = this.loadedTracks.get(trackId);
		return loadedTrack ? loadedTrack.info : null;
	}

	/**
	 * Check if track is loaded in memory
	 */
	isTrackLoaded(trackId: string): boolean {
		return this.loadedTracks.has(trackId);
	}

	/**
	 * Unload track from memory
	 */
	unloadTrack(trackId: string): void {
		this.loadedTracks.delete(trackId);
	}

	/**
	 * Clean up all resources
	 */
	async cleanup(): Promise<void> {
		this.loadedTracks.clear();
		if (this.audioContext) {
			await this.audioContext.close();
			this.audioContext = null;
		}
	}

	/**
	 * Get available tracks from OPFS
	 */
	async getAvailableTracksFromOPFS(): Promise<string[]> {
		return await opfsManager.listAudioFiles();
	}

	/**
	 * Delete track from OPFS and memory
	 */
	async deleteTrackFromOPFS(trackId: string): Promise<void> {
		await opfsManager.deleteAudioFile(trackId);
		this.unloadTrack(trackId);
	}
}

export const audioService = AudioService.getInstance();
