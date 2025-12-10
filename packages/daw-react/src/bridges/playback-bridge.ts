/**
 * Playback Service Bridge
 * SDK Transport is the playback engine
 */

"use client";

import type { DAW, Track } from "@wav0/daw-sdk";

/**
 * Bridge between React components and SDK Transport
 * SDK Transport handles all playback, loop continuation, automation
 */
export class PlaybackServiceBridge {
	private cleanupFns: (() => void)[] = [];
	private playbackCleanup: (() => void) | null = null;
	private disposed = false;

	constructor(private sdk: DAW) {
		this.setupEventSync();
	}

	/**
	 * Clean up listeners from previous playback session
	 */
	private cleanupPlaybackListeners(): void {
		if (this.playbackCleanup) {
			this.playbackCleanup();
			this.playbackCleanup = null;
		}
	}

	private setupEventSync(): void {
		const transport = this.sdk.getTransport();

		// Log Transport events for debugging
		const handleStateChange = ((event: CustomEvent) => {
			const { type, state, currentTime } = event.detail;
			console.log(`[PlaybackBridge] Transport ${type}:`, state, currentTime);
		}) as EventListener;

		transport.addEventListener("transport", handleStateChange);
		this.cleanupFns.push(() => {
			transport.removeEventListener("transport", handleStateChange);
		});
	}

	/**
	 * Play tracks from specified time
	 * SDK Transport handles loop continuation, automation, gain chains
	 */
	async play(
		tracks: Track[],
		options?: {
			startTime?: number;
			onTimeUpdate?: (time: number) => void;
			onPlaybackEnd?: () => void;
		},
	): Promise<void> {
		// Clean up listeners from previous playback session
		this.cleanupPlaybackListeners();

		const transport = this.sdk.getTransport();

		// Set up event listeners for callbacks
		const cleanupFns: (() => void)[] = [];

		if (options?.onTimeUpdate) {
			const handleTimeUpdate = ((event: CustomEvent) => {
				if (this.disposed) return;
				// SDK Transport sends ms, callback expects seconds
				options.onTimeUpdate?.(event.detail.currentTime / 1000);
			}) as EventListener;
			transport.addEventListener("time-update", handleTimeUpdate);
			cleanupFns.push(() =>
				transport.removeEventListener("time-update", handleTimeUpdate),
			);
		}

		if (options?.onPlaybackEnd) {
			// Use debounced handler to avoid false positives from internal stop→play cycles
			// (e.g., transport.play() calls stop() before starting new playback)
			let stopDebounce: ReturnType<typeof setTimeout> | null = null;
			const handleStop = ((event: CustomEvent) => {
				if (this.disposed) return;
				if (event.detail.type === "stop") {
					// Debounce stop events - if play happens within 50ms, don't fire onPlaybackEnd
					if (stopDebounce) clearTimeout(stopDebounce);
					stopDebounce = setTimeout(() => {
						stopDebounce = null;
						// Only fire if we're still stopped (not playing again)
						if (transport.getState() !== "playing") {
							options.onPlaybackEnd?.();
						}
					}, 50);
				} else if (event.detail.type === "play") {
					// Cancel pending stop callback if play starts
					if (stopDebounce) {
						clearTimeout(stopDebounce);
						stopDebounce = null;
					}
				}
			}) as EventListener;
			transport.addEventListener("transport", handleStop);
			cleanupFns.push(() => {
				if (stopDebounce) clearTimeout(stopDebounce);
				transport.removeEventListener("transport", handleStop);
			});
		}

		// Store cleanup for this playback session
		this.playbackCleanup = () => {
			for (const fn of cleanupFns) fn();
		};

		// Play via SDK Transport (convert seconds to ms)
		const startTimeMs = (options?.startTime ?? 0) * 1000;
		await transport.play(tracks, startTimeMs);
	}

	/**
	 * Initialize tracks with playback engine (required before play)
	 */
	async initializeWithTracks(tracks: Track[]): Promise<void> {
		const transport = this.sdk.getTransport();
		await transport.initializeWithTracks(tracks);
	}

	/**
	 * Stop playback
	 */
	async stop(): Promise<void> {
		const transport = this.sdk.getTransport();
		transport.stop();
	}

	/**
	 * Pause playback
	 */
	async pause(): Promise<void> {
		const transport = this.sdk.getTransport();
		transport.pause();
	}

	/**
	 * Resume playback from paused position
	 */
	async resume(): Promise<void> {
		const transport = this.sdk.getTransport();
		await transport.resume();
	}

	/**
	 * Seek to time
	 */
	async seek(timeMs: number): Promise<void> {
		const transport = this.sdk.getTransport();
		transport.seek(timeMs);
	}

	/**
	 * Get current playback time (in seconds, for legacy compatibility)
	 */
	getCurrentTime(): number {
		const transport = this.sdk.getTransport();
		// SDK Transport returns ms, convert to seconds for legacy API
		return transport.getCurrentTime() / 1000;
	}

	/**
	 * Check if playing
	 */
	isPlaying(): boolean {
		const transport = this.sdk.getTransport();
		return transport.getState() === "playing";
	}

	/**
	 * Update track volume
	 */
	updateTrackVolume(trackId: string, volumeDb: number): void {
		const transport = this.sdk.getTransport();
		transport.updateTrackVolume(trackId, volumeDb);
	}

	/**
	 * Update track volume during playback without disrupting automation
	 * Scales the base volume that automation multiplies against
	 */
	updateTrackVolumeRealtime(trackId: string, volumeDb: number): void {
		const transport = this.sdk.getTransport();
		transport.updateTrackVolumeRealtime(trackId, volumeDb);
	}

	/**
	 * Update track mute state
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
		const transport = this.sdk.getTransport();
		transport.updateTrackMute(trackId, muted, isSoloed, soloEngaged);
	}

	/**
	 * Update solo states for all tracks
	 */
	updateSoloStates(tracks: Track[]): void {
		const transport = this.sdk.getTransport();
		transport.updateSoloStates(tracks);
	}

	/**
	 * Synchronize tracks with playback engine
	 * SDK Transport handles clip rescheduling internally via synchronizeClipsGlobal
	 */
	async synchronizeTracks(tracks: Track[]): Promise<void> {
		const transport = this.sdk.getTransport();
		await transport.synchronizeTracks(tracks);
	}

	/**
	 * Reschedule a specific track during playback
	 * SDK Transport handles this via synchronizeTracks - pass all tracks for proper diff
	 */
	async rescheduleTrack(track: Track, allTracks?: Track[]): Promise<void> {
		// SDK Transport uses synchronizeTracks for all rescheduling
		// Pass allTracks if available, otherwise just the single track
		const transport = this.sdk.getTransport();
		await transport.synchronizeTracks(allTracks ?? [track]);
	}

	/**
	 * Get master meter level in dB
	 */
	getMasterMeterDb(): number {
		const transport = this.sdk.getTransport();
		return transport.getMasterDb();
	}

	/**
	 * Alias for getMasterMeterDb for service registry compatibility
	 */
	getMasterDb(): number {
		return this.getMasterMeterDb();
	}

	/**
	 * Set master volume (linear gain 0-1)
	 */
	setMasterVolume(linearGain: number): void {
		const transport = this.sdk.getTransport();
		transport.setMasterVolume(linearGain);
	}

	/**
	 * Cleanup bridge resources
	 */
	dispose(): void {
		this.disposed = true;
		// Clean up playback session listeners
		this.cleanupPlaybackListeners();
		// Clean up persistent listeners (e.g., event sync)
		for (const cleanup of this.cleanupFns) {
			cleanup();
		}
		this.cleanupFns = [];
	}
}
