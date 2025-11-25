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
	 * Stop playback - uses SDK Transport first, falls back to legacy
	 */
	async stop(): Promise<void> {
		try {
			const transport = this.sdk.getTransport();
			transport.stop();
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy stop", err);
		}
		// Always stop legacy too for safety
		await this.legacyService.stop();
	}

	/**
	 * Pause playback - uses SDK Transport first, falls back to legacy
	 */
	async pause(): Promise<void> {
		try {
			const transport = this.sdk.getTransport();
			transport.pause();
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy pause", err);
		}
		await this.legacyService.pause();
	}

	/**
	 * Resume playback through legacy service
	 */
	async resume(): Promise<void> {
		await this.legacyService.resume();
	}

	/**
	 * Seek to time - uses SDK Transport first, falls back to legacy
	 */
	async seek(timeMs: number): Promise<void> {
		try {
			const transport = this.sdk.getTransport();
			transport.seek(timeMs);
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy seek", err);
		}
		await this.legacyService.seek(timeMs);
	}

	/**
	 * Get current playback time - uses SDK Transport first
	 */
	getCurrentTime(): number {
		try {
			const transport = this.sdk.getTransport();
			return transport.getCurrentTime();
		} catch (err) {
			return this.legacyService.getCurrentTime();
		}
	}

	/**
	 * Check if playing - uses SDK Transport first
	 */
	isPlaying(): boolean {
		try {
			const transport = this.sdk.getTransport();
			return transport.getState() === "playing";
		} catch (err) {
			return this.legacyService.isPlaying();
		}
	}

	/**
	 * Update track volume - uses SDK Transport for realtime updates
	 */
	updateTrackVolume(trackId: string, volume: number): void {
		try {
			const transport = this.sdk.getTransport();
			// Convert percentage to dB
			const volumeDb = volume <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(volume / 100);
			transport.updateTrackVolumeRealtime(trackId, volumeDb);
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy updateTrackVolume", err);
		}
		this.legacyService.updateTrackVolume(trackId, volume);
	}

	/**
	 * Update track mute state - uses SDK Transport
	 * @param trackId - Track ID to update
	 * @param muted - Track's mute flag
	 * @param isSoloed - Whether this track is soloed
	 * @param soloEngaged - Whether any track has solo enabled
	 */
	updateTrackMute(
		trackId: string,
		muted: boolean,
		isSoloed: boolean,
		soloEngaged: boolean,
	): void {
		try {
			const transport = this.sdk.getTransport();
			transport.updateTrackMute(trackId, muted, isSoloed, soloEngaged);
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy updateTrackMute", err);
		}
		// Legacy service still uses old signature (volume param unused for mute)
		this.legacyService.updateTrackMute(trackId, muted, 75);
	}

	/**
	 * Update solo states for all tracks - uses SDK Transport
	 */
	updateSoloStates(tracks: Track[]): void {
		try {
			const transport = this.sdk.getTransport();
			transport.updateSoloStates(tracks);
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy updateSoloStates", err);
		}
		this.legacyService.updateSoloStates(tracks);
	}

	/**
	 * Synchronize tracks with playback engine - uses SDK Transport
	 */
	async synchronizeTracks(tracks: Track[]): Promise<void> {
		try {
			const transport = this.sdk.getTransport();
			await transport.synchronizeTracks(tracks);
		} catch (err) {
			console.warn("[PlaybackBridge] Using legacy synchronizeTracks", err);
		}
		await this.legacyService.synchronizeTracks(tracks);
	}

	/**
	 * Reschedule a specific track during playback
	 */
	async rescheduleTrack(track: Track, allTracks?: Track[]): Promise<void> {
		await this.legacyService.rescheduleTrack(track, allTracks);
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
