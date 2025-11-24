/**
 * Playback Service Bridge
 * Wraps legacy playbackService singleton with new SDK Transport
 * Maintains bidirectional sync during migration
 */

"use client";

import type { DAW, Track } from "@wav0/daw-sdk";

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
	 * Play - tries new SDK Transport first, falls back to legacy if error
	 */
	async play(
		tracks: Track[],
		options?: {
			startTime?: number;
			onTimeUpdate?: (time: number) => void;
			onPlaybackEnd?: () => void;
		},
	): Promise<void> {
		try {
			const transport = this.sdk.getTransport();
			
			// Initialize tracks
			await transport.initializeWithTracks(tracks);
			
			// Convert startTime from seconds to milliseconds
			const fromTime = options?.startTime ? options.startTime * 1000 : 0;
			
			// Play through new SDK first (this may call stop() internally)
			await transport.play(tracks, fromTime);
			
			// Set up event listeners AFTER play() completes to avoid catching
			// the initial stop event that play() dispatches internally
			if (options?.onTimeUpdate || options?.onPlaybackEnd) {
				const handleTimeUpdate = ((event: CustomEvent) => {
					const { currentTime } = event.detail;
					// Convert from milliseconds to seconds for callback
					options?.onTimeUpdate?.(currentTime / 1000);
				}) as EventListener;
				
				const handleStop = ((event: CustomEvent) => {
					const { type } = event.detail;
					if (type === "stop") {
						options?.onPlaybackEnd?.();
					}
				}) as EventListener;
				
				transport.addEventListener("time-update", handleTimeUpdate);
				transport.addEventListener("transport", handleStop);
				
				// Cleanup listeners after playback ends
				const cleanup = () => {
					transport.removeEventListener("time-update", handleTimeUpdate);
					transport.removeEventListener("transport", handleStop);
				};
				
				// Store cleanup for later
				this.cleanupFns.push(cleanup);
			}
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy playback", err);
			// Fallback to legacy
			await this.legacyService.play(tracks, options || {});
		}
	}

	/**
	 * Initialize tracks with playback engine (required before play)
	 */
	async initializeWithTracks(tracks: Track[]): Promise<void> {
		await this.legacyService.initializeWithTracks(tracks);
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
	 * Get master meter level in dB - tries SDK first, falls back to legacy
	 */
	getMasterMeterDb(): number {
		try {
			const transport = this.sdk.getTransport();
			return transport.getMasterDb();
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy getMasterDb", err);
			return this.legacyService.getMasterDb();
		}
	}

	/**
	 * Set master volume - tries SDK first, falls back to legacy
	 */
	setMasterVolume(volume: number): void {
		try {
			const transport = this.sdk.getTransport();
			transport.setMasterVolume(volume);
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy setMasterVolume", err);
			this.legacyService.setMasterVolume(volume);
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
