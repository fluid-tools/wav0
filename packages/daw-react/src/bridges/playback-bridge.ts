/**
 * Playback Service Bridge
 * Primary interface to SDK Transport with legacy fallback for rescheduleTrack
 */

"use client";

import type { DAW, Track } from "@wav0/daw-sdk";

/**
 * Bridge between React components and SDK Transport
 * SDK-first approach - legacy only used for features not yet in SDK
 */
export class PlaybackServiceBridge {
	private cleanupFns: (() => void)[] = [];
	private playbackCleanup: (() => void) | null = null;

	constructor(
		private sdk: DAW,
		private legacyService: any,
	) {
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
			const { state, currentTime } = event.detail;
			console.log("[PlaybackBridge] Transport state:", state, currentTime);
		}) as EventListener;

		transport.addEventListener("transport", handleStateChange);
		this.cleanupFns.push(() => {
			transport.removeEventListener("transport", handleStateChange);
		});
	}

	/**
	 * Play tracks from specified time
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

		// Initialize tracks
		await transport.initializeWithTracks(tracks);

		// Convert startTime from seconds to milliseconds
		const fromTime = options?.startTime ? options.startTime * 1000 : 0;

		// Play through SDK Transport
		await transport.play(tracks, fromTime);

		// Set up event listeners for callbacks
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
					// Clean up listeners when playback ends naturally
					this.cleanupPlaybackListeners();
				}
			}) as EventListener;

			transport.addEventListener("time-update", handleTimeUpdate);
			transport.addEventListener("transport", handleStop);

			// Store cleanup for this playback session
			this.playbackCleanup = () => {
				transport.removeEventListener("time-update", handleTimeUpdate);
				transport.removeEventListener("transport", handleStop);
			};
		}
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
	 * Get current playback time
	 */
	getCurrentTime(): number {
		const transport = this.sdk.getTransport();
		return transport.getCurrentTime();
	}

	/**
	 * Check if playing
	 */
	isPlaying(): boolean {
		const transport = this.sdk.getTransport();
		return transport.getState() === "playing";
	}

	/**
	 * Update track volume (realtime during playback)
	 */
	updateTrackVolume(trackId: string, volume: number): void {
		const transport = this.sdk.getTransport();
		// Convert percentage to dB
		const volumeDb =
			volume <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(volume / 100);
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
	 */
	async synchronizeTracks(tracks: Track[]): Promise<void> {
		const transport = this.sdk.getTransport();
		await transport.synchronizeTracks(tracks);
	}

	/**
	 * Reschedule a specific track during playback
	 * NOTE: Still uses legacy service - SDK reschedule not fully implemented
	 */
	async rescheduleTrack(track: Track, allTracks?: Track[]): Promise<void> {
		await this.legacyService.rescheduleTrack(track, allTracks);
	}

	/**
	 * Get master meter level in dB
	 */
	getMasterMeterDb(): number {
		const transport = this.sdk.getTransport();
		return transport.getMasterDb();
	}

	/**
	 * Set master volume
	 */
	setMasterVolume(volume: number): void {
		const transport = this.sdk.getTransport();
		transport.setMasterVolume(volume);
	}

	/**
	 * Cleanup bridge resources
	 */
	dispose(): void {
		// Clean up playback session listeners
		this.cleanupPlaybackListeners();
		// Clean up persistent listeners (e.g., event sync)
		for (const cleanup of this.cleanupFns) {
			cleanup();
		}
		this.cleanupFns = [];
	}
}
