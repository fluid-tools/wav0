export const VOLUME_MIN_DB = -30;
export const VOLUME_MAX_DB = 6;

// Automation envelope ranges (more flexible than track volume)
export const AUTOMATION_MIN_DB = -60; // Very quiet
export const AUTOMATION_MAX_DB = 12; // +12dB boost

export function volumeToDb(volume: number): number {
	if (!Number.isFinite(volume) || volume <= 0) return Number.NEGATIVE_INFINITY;
	const linear = volume / 100;
	return 20 * Math.log10(linear);
}

export function dbToVolume(db: number): number {
	if (!Number.isFinite(db)) return 0;
	const clamped = clampDb(db);
	if (clamped === Number.NEGATIVE_INFINITY) return 0;
	const linear = 10 ** (db / 20);
	return Math.max(0, Math.round(linear * 100));
}

export function formatDb(db: number, precision = 1): string {
	if (!Number.isFinite(db)) return "-∞ dB";
	const rounded = Math.round(db * 10 ** precision) / 10 ** precision;
	const sign = rounded > 0 ? "+" : "";
	return `${sign}${rounded.toFixed(precision)} dB`;
}

export function clampDb(db: number): number {
	if (!Number.isFinite(db)) return Number.NEGATIVE_INFINITY;
	return Math.min(VOLUME_MAX_DB, Math.max(VOLUME_MIN_DB, db));
}

// === AUTOMATION-SPECIFIC CONVERSIONS ===

/**
 * Convert envelope multiplier (0-4 range) to dB
 * - 0 → -∞ dB (silence)
 * - 1 → 0 dB (unity/no change)
 * - 2 → +6 dB (double amplitude)
 * - 4 → +12 dB (4x amplitude)
 */
export function multiplierToDb(multiplier: number): number {
	if (!Number.isFinite(multiplier) || multiplier <= 0) {
		return Number.NEGATIVE_INFINITY;
	}
	return 20 * Math.log10(multiplier);
}

/**
 * Convert dB to envelope multiplier (0-4 range)
 * - -∞ dB → 0 (silence)
 * - 0 dB → 1 (unity)
 * - +6 dB → 2 (double)
 * - +12 dB → 4 (4x)
 */
export function dbToMultiplier(db: number): number {
	if (!Number.isFinite(db)) return 0;
	return 10 ** (db / 20);
}

/**
 * Clamp dB value to automation-safe range
 */
export function clampAutomationDb(db: number): number {
	if (!Number.isFinite(db)) return Number.NEGATIVE_INFINITY;
	return Math.min(AUTOMATION_MAX_DB, Math.max(AUTOMATION_MIN_DB, db));
}

/**
 * Get effective dB at a given time in an automation curve
 * Combines base track volume with envelope automation
 */
export function getEffectiveDb(
	baseVolumePercent: number,
	envelopeMultiplier: number,
): number {
	const baseDb = volumeToDb(baseVolumePercent);
	const envelopeDb = multiplierToDb(envelopeMultiplier);

	if (!Number.isFinite(baseDb) || !Number.isFinite(envelopeDb)) {
		return Number.NEGATIVE_INFINITY;
	}

	// In dB space: addition = multiplication in linear space
	return baseDb + envelopeDb;
}

/**
 * Format effective gain for display
 * Shows combined base + automation value
 */
export function formatEffectiveDb(
	baseVolumePercent: number,
	envelopeMultiplier: number,
	precision = 1,
): string {
	const effectiveDb = getEffectiveDb(baseVolumePercent, envelopeMultiplier);
	return formatDb(effectiveDb, precision);
}
