/**
 * Performance & Update Rate Constants
 *
 * Centralized configuration for all timing/FPS-related values in the DAW.
 * These constants balance visual smoothness against CPU/render overhead.
 *
 * ## Design Philosophy
 *
 * | Category              | Target Rate | Rationale                                      |
 * |-----------------------|-------------|------------------------------------------------|
 * | User interactions     | Uncapped    | Drag/resize/scroll must feel 1:1 responsive   |
 * | Playhead position     | 60fps RAF   | Smooth visual tracking during playback        |
 * | Transport time events | 60fps RAF   | Synced to audio engine callback cycle         |
 * | Time display readout  | 10Hz        | Humans can't read ms that fast anyway         |
 * | VU/Level meters       | 30fps       | Industry standard, no perceptual benefit >25  |
 * | Waveform scroll       | 24-30fps    | Smooth enough, saves GPU                       |
 *
 * ## Adaptive Throttling
 *
 * Under CPU pressure (detected via frame budget overruns), components can
 * dynamically reduce their update rate using THROTTLE_FALLBACK_* constants.
 */

// =============================================================================
// UNCAPPED (60fps+) - Direct user input feedback
// =============================================================================

/**
 * User drag interactions (clip move, resize, selection)
 * Run at native refresh rate - no throttling.
 */
export const INTERACTION_UPDATE_RATE = "uncapped" as const;

/**
 * Scroll/pan gestures
 * Run at native refresh rate - no throttling.
 */
export const SCROLL_UPDATE_RATE = "uncapped" as const;

// =============================================================================
// 60fps - Core playback visuals
// =============================================================================

/**
 * Transport emits time-update at RAF rate (~60fps on 60Hz displays).
 * This drives playhead position and auto-scroll during playback.
 *
 * Note: This is the SOURCE event rate. Components may throttle consumption.
 */
export const TRANSPORT_TIME_UPDATE_RATE_HZ = 60;

/**
 * Playhead position updates during playback.
 * Direct DOM manipulation, bypasses React render cycle.
 */
export const PLAYHEAD_UPDATE_RATE_HZ = 60;

// =============================================================================
// 30fps - Visual meters (industry standard for VU/level meters)
// =============================================================================

/**
 * Master/track VU meters update rate.
 * 30fps is industry standard - no perceptual benefit beyond ~25fps for meters.
 * Saves significant CPU vs 60fps with no visible difference.
 */
export const METER_UPDATE_RATE_HZ = 30;

/**
 * Minimum interval between meter updates (ms)
 */
export const METER_UPDATE_INTERVAL_MS = 1000 / METER_UPDATE_RATE_HZ; // ~33ms

/**
 * Meter dB threshold for skipping re-render (avoid micro-fluctuations)
 */
export const METER_DB_CHANGE_THRESHOLD = 0.25;

// =============================================================================
// 10Hz - Text readouts (time display, BPM, etc.)
// =============================================================================

/**
 * Transport time display update rate.
 * 10Hz is sufficient for readable time codes - nobody reads faster.
 */
export const TIME_DISPLAY_UPDATE_RATE_HZ = 10;

/**
 * Interval between time display updates (ms)
 */
export const TIME_DISPLAY_UPDATE_INTERVAL_MS =
	1000 / TIME_DISPLAY_UPDATE_RATE_HZ; // 100ms

/**
 * Minimum time change (ms) to trigger display update
 * Prevents micro-updates that are imperceptible
 */
export const TIME_DISPLAY_CHANGE_THRESHOLD_MS = 10;

// =============================================================================
// Adaptive Throttling - Fallback rates under CPU pressure
// =============================================================================

/**
 * Fallback meter rate when CPU is under pressure
 */
export const THROTTLE_FALLBACK_METER_RATE_HZ = 15;

/**
 * Fallback time display rate when CPU is under pressure
 */
export const THROTTLE_FALLBACK_TIME_DISPLAY_RATE_HZ = 5;

/**
 * Frame budget threshold (ms) - if frame takes longer, consider throttling
 * 16.67ms = 60fps frame budget
 */
export const FRAME_BUDGET_MS = 16.67;

/**
 * Consecutive overruns before engaging throttle mode
 */
export const THROTTLE_TRIGGER_COUNT = 5;

// =============================================================================
// Waveform Rendering
// =============================================================================

/**
 * Waveform redraw rate during scroll/zoom
 * Lower than 60fps to save GPU while still feeling smooth
 */
export const WAVEFORM_REDRAW_RATE_HZ = 24;

/**
 * Waveform redraw interval (ms)
 */
export const WAVEFORM_REDRAW_INTERVAL_MS = 1000 / WAVEFORM_REDRAW_RATE_HZ; // ~42ms

// =============================================================================
// Automation Visualization
// =============================================================================

/**
 * Automation curve visualization update rate
 * Matches meter rate - no need to be faster for envelope display
 */
export const AUTOMATION_VISUAL_UPDATE_RATE_HZ = 30;

// =============================================================================
// Exports for external consumption
// =============================================================================

export const PERFORMANCE_CONFIG = {
	// Uncapped (native refresh)
	interaction: INTERACTION_UPDATE_RATE,
	scroll: SCROLL_UPDATE_RATE,

	// 60fps tier
	transportTimeUpdate: TRANSPORT_TIME_UPDATE_RATE_HZ,
	playhead: PLAYHEAD_UPDATE_RATE_HZ,

	// 30fps tier
	meter: METER_UPDATE_RATE_HZ,
	meterIntervalMs: METER_UPDATE_INTERVAL_MS,
	meterDbThreshold: METER_DB_CHANGE_THRESHOLD,
	automationVisual: AUTOMATION_VISUAL_UPDATE_RATE_HZ,

	// 10Hz tier
	timeDisplay: TIME_DISPLAY_UPDATE_RATE_HZ,
	timeDisplayIntervalMs: TIME_DISPLAY_UPDATE_INTERVAL_MS,
	timeDisplayThresholdMs: TIME_DISPLAY_CHANGE_THRESHOLD_MS,

	// Waveform
	waveform: WAVEFORM_REDRAW_RATE_HZ,
	waveformIntervalMs: WAVEFORM_REDRAW_INTERVAL_MS,

	// Adaptive throttling
	throttleFallbackMeter: THROTTLE_FALLBACK_METER_RATE_HZ,
	throttleFallbackTimeDisplay: THROTTLE_FALLBACK_TIME_DISPLAY_RATE_HZ,
	frameBudgetMs: FRAME_BUDGET_MS,
	throttleTriggerCount: THROTTLE_TRIGGER_COUNT,
} as const;
