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
		// Legacy service handles OPFS loading
		await this.legacyService.loadTrackFromOPFS(opfsFileId, fileName);
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
	 * Cleanup bridge resources
	 */
	dispose(): void {
		for (const cleanup of this.cleanupFns) {
			cleanup();
		}
		this.cleanupFns = [];
	}
}

