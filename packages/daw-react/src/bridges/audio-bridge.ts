/**
 * Audio Service Bridge
 * Wraps SDK AudioEngine for service registry compatibility
 * SDK AudioEngine is the ONLY source - no legacy fallback
 */

"use client";

import type { AudioData, DAW } from "@wav0/daw-sdk";

/**
 * Bridge between service registry and SDK AudioEngine
 * Provides compatibility layer for atoms expecting legacy interface
 */
export class AudioServiceBridge {
	private cleanupFns: (() => void)[] = [];

	constructor(private sdk: DAW) {
		this.setupEventSync();
	}

	private setupEventSync(): void {
		const audioEngine = this.sdk.getAudioEngine();

		// Sync SDK events for logging/debugging
		const handleTrackLoaded = ((event: CustomEvent) => {
			const { id } = event.detail;
			console.log("[AudioBridge] Track loaded via SDK:", id);
		}) as EventListener;

		audioEngine.addEventListener("trackloaded", handleTrackLoaded);
		this.cleanupFns.push(() => {
			audioEngine.removeEventListener("trackloaded", handleTrackLoaded);
		});
	}

	/**
	 * Load audio file - SDK only
	 */
	async loadAudioFile(file: File, id: string): Promise<AudioData & { fileName: string; fileType: string }> {
		const audioEngine = this.sdk.getAudioEngine();

		// Load through SDK
		const audioData = await audioEngine.loadAudio(file, id);

		// Save to OPFS via SDK
		const audioFileData = await file.arrayBuffer();
		try {
			await audioEngine.saveToOPFS(id, audioFileData);
		} catch (error) {
			console.warn("[AudioBridge] OPFS save failed:", error);
		}

		// Return SDK format with additional properties atoms expect
		return {
			...audioData,
			fileName: file.name,
			fileType: file.type,
		};
	}

	/**
	 * Load audio from OPFS - SDK only
	 */
	async loadFromOPFS(
		opfsFileId: string,
		fileName: string,
	): Promise<AudioData | null> {
		const audioEngine = this.sdk.getAudioEngine();
		return audioEngine.loadFromOPFS(opfsFileId, fileName);
	}

	/**
	 * Alias for loadFromOPFS to match service registry interface
	 * Used by initializeAudioFromOPFSAtom
	 */
	async loadTrackFromOPFS(
		opfsFileId: string,
		fileName: string,
	): Promise<void> {
		await this.loadFromOPFS(opfsFileId, fileName);
	}

	/**
	 * Get buffer sink - SDK only
	 * Returns MediaBunny AudioBufferSink for iterator access
	 */
	getBufferSink(trackId: string): unknown {
		const audioEngine = this.sdk.getAudioEngine();
		return audioEngine.getBufferSink(trackId);
	}

	/**
	 * Get full AudioBuffer for export - SDK only (with caching)
	 */
	async getAudioBuffer(
		opfsFileId: string,
		fileName = "",
	): Promise<AudioBuffer | null> {
		const audioEngine = this.sdk.getAudioEngine();
		return audioEngine.getAudioBuffer(opfsFileId, fileName);
	}

	/**
	 * Check if track is loaded - SDK only
	 */
	isTrackLoaded(trackId: string): boolean {
		const audioEngine = this.sdk.getAudioEngine();
		return audioEngine.isTrackLoaded(trackId);
	}

	/**
	 * Unload track - SDK only
	 */
	unloadTrack(trackId: string): void {
		const audioEngine = this.sdk.getAudioEngine();
		audioEngine.unloadTrack(trackId);
	}

	/**
	 * Delete track from OPFS - SDK only
	 */
	async deleteFromOPFS(trackId: string): Promise<void> {
		const audioEngine = this.sdk.getAudioEngine();
		await audioEngine.deleteFromOPFS(trackId);
	}

	/**
	 * Get AudioContext from SDK
	 */
	getAudioContext(): AudioContext {
		return this.sdk.getAudioContext();
	}

	/**
	 * Cleanup bridge resources
	 */
	dispose(): void {
		for (const cleanup of this.cleanupFns) {
			cleanup();
		}
		this.cleanupFns = [];
	}
}
