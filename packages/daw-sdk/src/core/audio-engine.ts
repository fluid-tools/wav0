/**
 * AudioEngine - Core audio file management with MediaBunny
 *
 * Event-driven architecture:
 * - Emits 'trackloaded' when audio is loaded
 * - Zero persistence - React layer handles storage via events
 * - Pure MediaBunny operations
 */

import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type InputAudioTrack,
} from "mediabunny";
import type { AudioData } from "../types/core";
import type { OPFSManager } from "./opfs-manager";

export interface LoadedTrack {
	id: string;
	input: Input;
	sink: AudioBufferSink;
	audioTrack: InputAudioTrack;
	duration: number;
}

export class AudioEngine extends EventTarget {
	private loadedTracks = new Map<string, LoadedTrack>();
	/** Cached full AudioBuffers for export/offline rendering */
	private audioBufferCache = new Map<string, AudioBuffer>();
	/** Maximum number of cached AudioBuffers before eviction */
	private static readonly MAX_CACHE_SIZE = 20;

	constructor(
		private _audioContext: AudioContext,
		private opfsManager?: OPFSManager,
	) {
		super();
	}

	async loadAudio(file: File, id: string): Promise<AudioData> {
		const input = new Input({
			formats: ALL_FORMATS,
			source: new BlobSource(file),
		});

		const audioTrack = await input.getPrimaryAudioTrack();
		if (!audioTrack) throw new Error("No audio track found");

		const sink = new AudioBufferSink(audioTrack);
		const duration = await audioTrack.computeDuration();

		this.loadedTracks.set(id, {
			id,
			input,
			sink,
			audioTrack,
			duration,
		});

		// Emit event for persistence layer
		this.dispatchEvent(
			new CustomEvent("trackloaded", {
				detail: {
					id,
					fileName: file.name,
					size: file.size,
					duration,
					sampleRate: audioTrack.sampleRate,
				},
			}),
		);

		return {
			id,
			duration,
			sampleRate: audioTrack.sampleRate,
			numberOfChannels: audioTrack.numberOfChannels,
		};
	}

	async getBufferIterator(
		audioId: string,
		startTime: number = 0,
		endTime?: number,
	): Promise<
		AsyncIterableIterator<{ buffer: AudioBuffer; timestamp: number }>
	> {
		let track = this.loadedTracks.get(audioId);

		// Self-healing: if track not loaded, try to load from OPFS
		if (!track && this.opfsManager) {
			try {
				await this.loadFromOPFS(audioId, "");
				track = this.loadedTracks.get(audioId);
			} catch (e) {
				// OPFS load failed, fall through to error
			}
		}

		if (!track) throw new Error(`Audio ${audioId} not loaded`);

		return track.sink.buffers(startTime, endTime);
	}

	getTrack(audioId: string): LoadedTrack | undefined {
		return this.loadedTracks.get(audioId);
	}

	hasTrack(audioId: string): boolean {
		return this.loadedTracks.has(audioId);
	}

	/**
	 * Get full AudioBuffer for a track (for export/offline rendering)
	 * Caches the result for subsequent calls
	 */
	async getAudioBuffer(
		opfsFileId: string,
		fileName = "",
	): Promise<AudioBuffer | null> {
		// Check cache first
		if (this.audioBufferCache.has(opfsFileId)) {
			const cached = this.audioBufferCache.get(opfsFileId);
			return cached ?? null;
		}

		let loadedTrack = this.loadedTracks.get(opfsFileId);
		if (!loadedTrack) {
			// Load from OPFS if not already loaded
			try {
				await this.loadFromOPFS(opfsFileId, fileName);
				loadedTrack = this.loadedTracks.get(opfsFileId);
			} catch (e) {
				console.error(`Failed to load audio for ${opfsFileId}:`, e);
				return null;
			}
		}
		if (!loadedTrack) return null;

		const duration = loadedTrack.duration;
		const buffers: AudioBuffer[] = [];
		for await (const { buffer } of loadedTrack.sink.buffers(0, duration)) {
			buffers.push(buffer);
		}
		if (buffers.length === 0) return null;

		const result =
			buffers.length === 1 ? buffers[0] : this.concatenateBuffers(buffers);

		// Cache the result with LRU eviction
		this.audioBufferCache.set(opfsFileId, result);

		// Evict oldest entry if cache exceeds max size
		if (this.audioBufferCache.size > AudioEngine.MAX_CACHE_SIZE) {
			const oldest = this.audioBufferCache.keys().next().value;
			if (oldest) {
				this.audioBufferCache.delete(oldest);
			}
		}

		return result;
	}

	/**
	 * Concatenate multiple AudioBuffers into one
	 */
	private concatenateBuffers(buffers: AudioBuffer[]): AudioBuffer {
		if (buffers.length === 0) throw new Error("No buffers to concatenate");
		if (buffers.length === 1) return buffers[0];

		const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
		const sampleRate = buffers[0].sampleRate;
		const numberOfChannels = buffers[0].numberOfChannels;

		const result = new OfflineAudioContext(
			numberOfChannels,
			totalLength,
			sampleRate,
		).createBuffer(numberOfChannels, totalLength, sampleRate);

		let offset = 0;
		for (const buf of buffers) {
			for (let ch = 0; ch < numberOfChannels; ch++) {
				result.getChannelData(ch).set(buf.getChannelData(ch), offset);
			}
			offset += buf.length;
		}
		return result;
	}

	/**
	 * Get buffer sink for a track (for direct iterator access)
	 */
	getBufferSink(audioId: string): AudioBufferSink | null {
		const track = this.loadedTracks.get(audioId);
		return track?.sink ?? null;
	}

	/**
	 * Check if track is loaded in memory
	 */
	isTrackLoaded(audioId: string): boolean {
		return this.loadedTracks.has(audioId);
	}

	/**
	 * Unload track from memory
	 */
	unloadTrack(audioId: string): void {
		this.loadedTracks.delete(audioId);
		this.audioBufferCache.delete(audioId);
	}

	async saveToOPFS(audioId: string, buffer: ArrayBuffer): Promise<void> {
		if (!this.opfsManager) {
			throw new Error("OPFS manager not configured");
		}
		await this.opfsManager.saveAudioFile(audioId, buffer);
	}

	async loadFromOPFS(
		audioId: string,
		_fileName: string,
	): Promise<AudioData | null> {
		if (!this.opfsManager) {
			throw new Error("OPFS manager not configured");
		}

		const arrayBuffer = await this.opfsManager.loadAudioFile(audioId);
		if (!arrayBuffer) {
			return null;
		}

		const input = new Input({
			formats: ALL_FORMATS,
			source: new BlobSource(new Blob([arrayBuffer])),
		});

		const audioTrack = await input.getPrimaryAudioTrack();
		if (!audioTrack) throw new Error("No audio track in OPFS file");

		const sink = new AudioBufferSink(audioTrack);
		const duration = await audioTrack.computeDuration();

		this.loadedTracks.set(audioId, {
			id: audioId,
			input,
			sink,
			audioTrack,
			duration,
		});

		return {
			id: audioId,
			duration,
			sampleRate: audioTrack.sampleRate,
			numberOfChannels: audioTrack.numberOfChannels,
		};
	}

	async deleteFromOPFS(audioId: string): Promise<void> {
		if (!this.opfsManager) {
			throw new Error("OPFS manager not configured");
		}
		await this.opfsManager.deleteAudioFile(audioId);
		this.loadedTracks.delete(audioId);
	}

	dispose(): void {
		// MediaBunny resources are garbage collected
		this.loadedTracks.clear();
		this.audioBufferCache.clear();
	}
}
