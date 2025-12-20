/**
 * Visual/Timeline Constants
 *
 * Constants for timeline rendering and viewport calculations.
 * These define the visual appearance and scaling of the DAW timeline.
 */

/**
 * Pixels per second at zoom level 1.0
 *
 * Base scale for timeline rendering. At zoom=1, there are 100 pixels per second.
 * Other zoom levels multiply this value.
 *
 * @example
 * ```ts
 * const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom) / 1000;
 * ```
 */
export const DAW_PIXELS_PER_SECOND_AT_ZOOM_1 = 100;

/**
 * Default timeline header height in pixels
 */
export const DAW_TIMELINE_HEADER_HEIGHT = 64;

/**
 * Default track height in pixels
 */
export const DAW_DEFAULT_TRACK_HEIGHT = 100;

/**
 * Minimum track height in pixels
 */
export const DAW_MIN_TRACK_HEIGHT = 60;

/**
 * Maximum track height in pixels
 */
export const DAW_MAX_TRACK_HEIGHT = 300;
