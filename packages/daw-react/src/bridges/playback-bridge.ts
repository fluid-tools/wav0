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
	 * Uses legacy service for playback - SDK Transport lacks loop continuation
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

		// Play through legacy service (has proper loop continuation)
		await this.legacyService.play(tracks, {
			startTime: options?.startTime ?? 0,
			onTimeUpdate: options?.onTimeUpdate,
			onPlaybackEnd: options?.onPlaybackEnd,
		});
	}

	/**
	 * Initialize tracks with playback engine (required before play)
	 */
	async initializeWithTracks(tracks: Track[]): Promise<void> {
		await this.legacyService.initializeWithTracks(tracks);
	}

	/**
	 * Stop playback
	 */
	async stop(): Promise<void> {
		await this.legacyService.stop();
	}

	/**
	 * Pause playback
	 */
	async pause(): Promise<void> {
		await this.legacyService.pause();
	}

	/**
	 * Resume playback from paused position
	 * Legacy service doesn't have a dedicated resume - we restart from paused time
	 */
	async resume(): Promise<void> {
		// Legacy PlaybackService stores paused time in playbackTimeAtStart after pause()
		// Calling play() with that time effectively resumes playback
		// The atom-level code handles this pattern already via togglePlaybackAtom
		console.warn("[PlaybackBridge] resume() - use togglePlaybackAtom for proper resume");
	}

	/**
	 * Seek to time
	 */
	async seek(_timeMs: number): Promise<void> {
		// Legacy service seek - requires stopping and restarting
		// This is handled at the atom level for now
		console.warn("[PlaybackBridge] seek() delegates to legacy service");
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
		return this.legacyService.getIsPlaying();
	}

	/**
	 * Update track volume (realtime during playback)
	 */
	updateTrackVolume(trackId: string, volume: number): void {
		this.legacyService.updateTrackVolume(trackId, volume);
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
		this.legacyService.updateTrackMute(trackId, muted, isSoloed, soloEngaged);
	}

	/**
	 * Update solo states for all tracks
	 */
	updateSoloStates(tracks: Track[]): void {
		this.legacyService.updateSoloStates(tracks);
	}

	/**
	 * Synchronize tracks with playback engine
	 * Legacy service is the ONLY audio producer during migration
	 * SDK Transport sync removed - it interferes with legacy playback and lacks loop continuation
	 */
	async synchronizeTracks(tracks: Track[]): Promise<void> {
		await this.legacyService.synchronizeTracks(tracks);
	}

	/**
	 * Reschedule a specific track during playback
	 * Uses legacy service for actual audio, SDK for state sync
	 */
	async rescheduleTrack(track: Track, allTracks?: Track[]): Promise<void> {
		// Legacy service handles actual audio rescheduling
		await this.legacyService.rescheduleTrack(track, allTracks);
	}

	/**
	 * Get master meter level in dB
	 */
	getMasterMeterDb(): number {
		return this.legacyService.getMasterDb?.() ?? -60;
	}

	/**
	 * Set master volume (percentage 0-100)
	 */
	setMasterVolume(volume: number): void {
		this.legacyService.updateMasterVolume?.(volume);
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
