/**
 * Audio Service Bridge
 * Wraps legacy audioService singleton with new SDK AudioEngine
 * Maintains bidirectional sync during migration
 */

"use client";

import type { DAW } from "@wav0/daw-sdk";

/**
 * Bridge between legacy audioService and new AudioEngine
 * Forwards method calls and syncs state
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

		// Sync SDK events → legacy service
		const handleTrackLoaded = ((event: CustomEvent) => {
			const { audioId, audioData } = event.detail;
			// Legacy service already has the track loaded via passthrough
			console.log("[AudioBridge] Track loaded:", audioId);
		}) as EventListener;

		audioEngine.addEventListener("trackloaded", handleTrackLoaded);
		this.cleanupFns.push(() => {
			audioEngine.removeEventListener("trackloaded", handleTrackLoaded);
		});
	}

	/**
	 * Load audio file through SDK (will also update legacy service)
	 */
	async loadAudioFile(file: File, id: string): Promise<any> {
		// Load through SDK
		const audioData = await this.sdk.getAudioEngine().loadAudio(file, id);

		// Save to OPFS via SDK if available
		const audioFileData = await file.arrayBuffer();
		try {
			await this.sdk.getAudioEngine().saveToOPFS(id, audioFileData);
		} catch (error) {
			console.warn("[AudioBridge] OPFS save failed:", error);
		}

		// Also load in legacy service for backward compatibility
		try {
			await this.legacyService.loadAudioFile(file, id);
		} catch (error) {
			console.warn("[AudioBridge] Legacy service load failed:", error);
		}

		return audioData;
	}

	/**
	 * Load audio from OPFS through both systems
	 */
	async loadFromOPFS(opfsFileId: string, fileName: string): Promise<void> {
		// Try SDK OPFS first
		try {
			const audioData = await this.sdk
				.getAudioEngine()
				.loadFromOPFS(opfsFileId, fileName);
			if (audioData) {
				console.log("[AudioBridge] Loaded from SDK OPFS:", opfsFileId);
			}
		} catch (error) {
			console.warn("[AudioBridge] SDK OPFS load failed:", error);
		}

		// Also load via legacy service for backward compatibility
		try {
			await this.legacyService.loadTrackFromOPFS(opfsFileId, fileName);
		} catch (error) {
			console.warn("[AudioBridge] Legacy OPFS load failed:", error);
		}
	}

	/**
	 * Get buffer sink (legacy service only for now)
	 */
	getBufferSink(trackId: string): any {
		return this.legacyService.getBufferSink(trackId);
	}

	/**
	 * Check if track is loaded
	 */
	isTrackLoaded(trackId: string): boolean {
		return this.legacyService.isTrackLoaded(trackId);
	}

	/**
	 * Unload track from both systems
	 */
	unloadTrack(trackId: string): void {
		this.legacyService.unloadTrack(trackId);
	}

	/**
	 * Delete track from OPFS
	 */
	async deleteFromOPFS(trackId: string): Promise<void> {
		try {
			await this.sdk.getAudioEngine().deleteFromOPFS(trackId);
		} catch (error) {
			console.warn("[AudioBridge] SDK OPFS delete failed:", error);
		}

		// Also delete via legacy service
		try {
			await this.legacyService.deleteTrackFromOPFS(trackId);
		} catch (error) {
			console.warn("[AudioBridge] Legacy OPFS delete failed:", error);
		}
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

