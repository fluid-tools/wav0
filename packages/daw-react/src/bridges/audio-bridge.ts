/**
 * Audio Service Bridge
 * Wraps legacy audioService singleton with new SDK AudioEngine
 * SDK AudioEngine is the PRIMARY source, legacy is fallback
 */

"use client";

import type { AudioData, DAW } from "@wav0/daw-sdk";

/**
 * Bridge between legacy audioService and new AudioEngine
 * SDK is primary, legacy is fallback for backward compatibility
 */
export class AudioServiceBridge {
	private cleanupFns: (() => void)[] = [];

	constructor(
		private sdk: DAW,
		private legacyService: any,
	) {
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
	 * Load audio file - SDK primary, legacy fallback
	 */
	async loadAudioFile(file: File, id: string): Promise<AudioData> {
		const audioEngine = this.sdk.getAudioEngine();

		// Load through SDK (primary)
		const audioData = await audioEngine.loadAudio(file, id);

		// Save to OPFS via SDK
		const audioFileData = await file.arrayBuffer();
		try {
			await audioEngine.saveToOPFS(id, audioFileData);
		} catch (error) {
			console.warn("[AudioBridge] OPFS save failed:", error);
		}

		// Also load in legacy service for backward compatibility
		try {
			await this.legacyService.loadAudioFile(file, id);
		} catch (error) {
			console.warn("[AudioBridge] Legacy service load failed:", error);
		}

		// Return SDK format with additional properties legacy expects
		return {
			...audioData,
			fileName: file.name,
			fileType: file.type,
		} as AudioData & { fileName: string; fileType: string };
	}

	/**
	 * Load audio from OPFS - SDK primary, legacy fallback
	 */
	async loadFromOPFS(
		opfsFileId: string,
		fileName: string,
	): Promise<AudioData | null> {
		const audioEngine = this.sdk.getAudioEngine();

		// Try SDK OPFS first (primary)
		try {
			const audioData = await audioEngine.loadFromOPFS(opfsFileId, fileName);
			if (audioData) {
				console.log("[AudioBridge] Loaded from SDK OPFS:", opfsFileId);

				// Also load via legacy service for backward compatibility
				try {
					await this.legacyService.loadTrackFromOPFS(opfsFileId, fileName);
				} catch (error) {
					console.warn("[AudioBridge] Legacy OPFS load failed:", error);
				}

				return audioData;
			}
		} catch (error) {
			console.warn("[AudioBridge] SDK OPFS load failed:", error);
		}

		// Fallback to legacy only
		try {
			await this.legacyService.loadTrackFromOPFS(opfsFileId, fileName);
			return null; // Legacy doesn't return AudioData
		} catch (error) {
			console.error("[AudioBridge] Both OPFS loads failed:", error);
			throw error;
		}
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
	 * Get buffer sink - SDK primary, legacy fallback
	 */
	getBufferSink(trackId: string): any {
		const audioEngine = this.sdk.getAudioEngine();
		const sink = audioEngine.getBufferSink(trackId);
		if (sink) return sink;
		return this.legacyService.getBufferSink(trackId);
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
	 * Check if track is loaded - SDK primary
	 */
	isTrackLoaded(trackId: string): boolean {
		const audioEngine = this.sdk.getAudioEngine();
		if (audioEngine.isTrackLoaded(trackId)) return true;
		return this.legacyService.isTrackLoaded(trackId);
	}

	/**
	 * Unload track from both systems
	 */
	unloadTrack(trackId: string): void {
		const audioEngine = this.sdk.getAudioEngine();
		audioEngine.unloadTrack(trackId);
		this.legacyService.unloadTrack(trackId);
	}

	/**
	 * Delete track from OPFS - both systems
	 */
	async deleteFromOPFS(trackId: string): Promise<void> {
		const audioEngine = this.sdk.getAudioEngine();

		try {
			await audioEngine.deleteFromOPFS(trackId);
		} catch (error) {
			console.warn("[AudioBridge] SDK OPFS delete failed:", error);
		}

		try {
			await this.legacyService.deleteTrackFromOPFS(trackId);
		} catch (error) {
			console.warn("[AudioBridge] Legacy OPFS delete failed:", error);
		}
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
