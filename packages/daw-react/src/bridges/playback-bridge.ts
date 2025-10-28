/**
 * Playback Service Bridge
 * Wraps legacy playbackService singleton with new SDK Transport
 * Maintains bidirectional sync during migration
 */

"use client";

import type { DAW } from "@wav0/daw-sdk";

/**
 * Bridge between legacy playbackService and new Transport
 * Forwards method calls and syncs state
 */
export class PlaybackServiceBridge {
	private cleanupFns: (() => void)[] = [];

	constructor(
		private sdk: DAW,
		private legacyService: any,
	) {
		this.setupEventSync();
	}

	private setupEventSync(): void {
		const transport = this.sdk.getTransport();

		// Sync Transport events → legacy service state
		const handleStateChange = ((event: CustomEvent) => {
			const { state, currentTime } = event.detail;
			console.log("[PlaybackBridge] Transport state:", state, currentTime);
			// Legacy service manages its own state for now
		}) as EventListener;

		transport.addEventListener("transport", handleStateChange);
		this.cleanupFns.push(() => {
			transport.removeEventListener("transport", handleStateChange);
		});
	}

	/**
	 * Play through legacy service (SDK not yet fully integrated)
	 */
	async play(tracks: any[], fromTime?: number): Promise<void> {
		await this.legacyService.play(tracks, fromTime);
	}

	/**
	 * Stop playback through legacy service
	 */
	async stop(): Promise<void> {
		await this.legacyService.stop();
	}

	/**
	 * Pause playback through legacy service
	 */
	async pause(): Promise<void> {
		await this.legacyService.pause();
	}

	/**
	 * Resume playback through legacy service
	 */
	async resume(): Promise<void> {
		await this.legacyService.resume();
	}

	/**
	 * Seek to time through legacy service
	 */
	async seek(timeMs: number): Promise<void> {
		await this.legacyService.seek(timeMs);
	}

	/**
	 * Get current playback time
	 */
	getCurrentTime(): number {
		return this.legacyService.getCurrentTime();
	}

	/**
	 * Check if playing
	 */
	isPlaying(): boolean {
		return this.legacyService.isPlaying();
	}

	/**
	 * Update track volume
	 */
	updateTrackVolume(trackId: string, volume: number): void {
		this.legacyService.updateTrackVolume(trackId, volume);
	}

	/**
	 * Update track mute state
	 */
	updateTrackMute(trackId: string, muted: boolean, volume: number): void {
		this.legacyService.updateTrackMute(trackId, muted, volume);
	}

	/**
	 * Update solo states for all tracks
	 */
	updateSoloStates(tracks: any[]): void {
		this.legacyService.updateSoloStates(tracks);
	}

	/**
	 * Synchronize tracks with playback engine
	 */
	synchronizeTracks(tracks: any[]): void {
		this.legacyService.synchronizeTracks(tracks);
	}

	/**
	 * Reschedule a specific track during playback
	 */
	async rescheduleTrack(track: any): Promise<void> {
		await this.legacyService.rescheduleTrack(track);
	}

	/**
	 * Get master meter level in dB
	 */
	getMasterMeterDb(): number {
		return this.legacyService.getMasterMeterDb();
	}

	/**
	 * Set master volume
	 */
	setMasterVolume(volume: number): void {
		this.legacyService.setMasterVolume(volume);
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

