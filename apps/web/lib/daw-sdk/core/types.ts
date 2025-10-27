/**
 * Core DAW SDK Types and Interfaces
 * 
 * Defines the fundamental contracts for audio processing, timeline calculations,
 * and playback management. These interfaces establish clear boundaries between
 * core logic, provider implementations, and UI layers.
 */

import type { AudioBufferSink } from "mediabunny";
import type {
	AudioFileInfo,
	PlaybackOptions,
	Track,
} from "../types/schemas";
import type { TimeGrid } from "../utils/time-grid";

// ===== Audio Provider Interface =====

/**
 * AudioProvider - Interface for audio file loading and management
 * 
 * Implementations handle:
 * - Audio file decoding and buffering
 * - Persistent storage (e.g., OPFS)
 * - Buffer caching and retrieval
 * - Resource cleanup
 */
export interface AudioProvider {
	/**
	 * Load an audio file from user upload
	 * @param file - The file to load
	 * @param trackId - Unique identifier for this track
	 * @returns Audio file metadata
	 */
	loadFile(file: File, trackId: string): Promise<AudioFileInfo>;

	/**
	 * Load an audio file from persistent storage
	 * @param trackId - Track identifier
	 * @param fileName - Original filename
	 * @returns Audio file metadata
	 */
	loadFromStorage(trackId: string, fileName: string): Promise<AudioFileInfo>;

	/**
	 * Get the audio buffer sink for playback
	 * @param trackId - Track identifier
	 * @returns AudioBufferSink for iteration or null if not loaded
	 */
	getAudioBuffer(trackId: string): AudioBufferSink | null;

	/**
	 * Save audio buffer to persistent storage
	 * @param trackId - Track identifier
	 * @param buffer - Audio data to store
	 */
	saveToStorage(trackId: string, buffer: ArrayBuffer): Promise<void>;

	/**
	 * Delete audio from persistent storage
	 * @param trackId - Track identifier
	 */
	deleteFromStorage(trackId: string): Promise<void>;

	/**
	 * Check if a track is currently loaded
	 * @param trackId - Track identifier
	 * @returns True if loaded
	 */
	isTrackLoaded(trackId: string): boolean;

	/**
	 * Clean up all resources
	 */
	cleanup(): Promise<void>;
}

// ===== Timeline Calculations Interface =====

export interface TimeGridParams {
	viewStartMs: number;
	viewEndMs: number;
	pxPerMs: number;
}

export interface FormatOptions {
	precision?: "seconds" | "milliseconds";
	includeHours?: boolean;
}

/**
 * TimelineCalculations - Pure functions for timeline computations
 * 
 * All methods are stateless and deterministic - same input always
 * produces the same output. No side effects.
 */
export interface TimelineCalculations {
	/**
	 * Snap a time value to the nearest grid point
	 * @param ms - Time in milliseconds
	 * @param gridSize - Grid interval in milliseconds
	 * @returns Snapped time value
	 */
	snapToGrid(ms: number, gridSize: number): number;

	/**
	 * Generate time grid markers for a viewport
	 * @param params - Viewport and zoom parameters
	 * @returns Grid data with major and minor markers
	 */
	generateTimeGrid(params: TimeGridParams): TimeGrid;

	/**
	 * Format milliseconds as human-readable duration
	 * @param ms - Time in milliseconds
	 * @param options - Formatting options
	 * @returns Formatted string (e.g., "1:23.456")
	 */
	formatDuration(ms: number, options?: FormatOptions): string;

	/**
	 * Convert milliseconds to pixels
	 * @param ms - Time in milliseconds
	 * @param pxPerMs - Pixels per millisecond (zoom level)
	 * @returns Position in pixels
	 */
	msToPixels(ms: number, pxPerMs: number): number;

	/**
	 * Convert pixels to milliseconds
	 * @param px - Position in pixels
	 * @param pxPerMs - Pixels per millisecond (zoom level)
	 * @returns Time in milliseconds
	 */
	pixelsToMs(px: number, pxPerMs: number): number;
}

// ===== Playback Engine Interface =====

/**
 * PlaybackEngine - Interface for audio playback control
 * 
 * Implementations handle:
 * - Multi-track playback scheduling
 * - Real-time volume/mute control
 * - Transport controls (play/pause/seek)
 * - Automation playback
 */
export interface PlaybackEngine {
	/**
	 * Start playback of tracks
	 * @param tracks - Tracks to play
	 * @param options - Playback configuration
	 */
	play(tracks: Track[], options: PlaybackOptions): Promise<void>;

	/**
	 * Pause playback (can be resumed)
	 */
	pause(): void;

	/**
	 * Stop playback (resets to start)
	 */
	stop(): void;

	/**
	 * Seek to a specific time
	 * @param timeMs - Target time in milliseconds
	 */
	seek(timeMs: number): void;

	/**
	 * Update track volume in real-time
	 * @param trackId - Track identifier
	 * @param volume - Volume level (0-100)
	 */
	updateTrackVolume(trackId: string, volume: number): void;

	/**
	 * Update track mute state
	 * @param trackId - Track identifier
	 * @param muted - True to mute
	 */
	updateTrackMute(trackId: string, muted: boolean): void;

	/**
	 * Get current playback time
	 * @returns Current time in milliseconds
	 */
	getPlaybackTime(): number;

	/**
	 * Check if currently playing
	 * @returns True if playing
	 */
	getIsPlaying(): boolean;

	/**
	 * Clean up all playback resources
	 */
	cleanup(): Promise<void>;
}

