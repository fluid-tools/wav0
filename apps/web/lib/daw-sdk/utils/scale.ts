/**
 * Centralized time-to-pixel conversions with viewport and scroll support
 * Ensures exact precision across all zoom levels
 */

export type Scale = {
	pxPerMs: number;
	scrollLeft: number;
};

/**
 * Convert milliseconds to absolute pixel position
 */
export function msToPx(ms: number, s: Scale): number {
	return ms * s.pxPerMs;
}

/**
 * Convert milliseconds to viewport pixel position (accounting for scroll)
 */
export function msToViewportPx(ms: number, s: Scale): number {
	return ms * s.pxPerMs - s.scrollLeft;
}

/**
 * Convert viewport pixel position to milliseconds
 */
export function viewportPxToMs(x: number, s: Scale): number {
	return (x + s.scrollLeft) / s.pxPerMs;
}

/**
 * Convert client X coordinate to milliseconds
 */
export function clientXToMs(
	clientX: number,
	elementLeft: number,
	s: Scale,
): number {
	const localX = clientX - elementLeft;
	return Math.max(0, viewportPxToMs(localX, s));
}

/**
 * Align to hairline for crisp 1px lines
 * Returns integer pixel + 0.5 offset
 */
export function alignHairline(x: number): number {
	return Math.round(x) + 0.5;
}

/**
 * Snap milliseconds to nearest grid step
 */
export function snapMs(ms: number, stepMs: number): number {
	const k = Math.round(ms / stepMs);
	return Math.max(0, k * stepMs);
}
