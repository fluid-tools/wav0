/**
 * Volume and dB conversion utilities
 */

export const VOLUME_MIN_DB = -30
export const VOLUME_MAX_DB = 6
export const AUTOMATION_MIN_DB = -60
export const AUTOMATION_MAX_DB = 12

/**
 * Convert volume percentage (0-100) to dB
 */
export function volumeToDb(volume: number): number {
	if (!Number.isFinite(volume) || volume <= 0) return Number.NEGATIVE_INFINITY
	const linear = volume / 100
	return 20 * Math.log10(linear)
}

/**
 * Convert dB to volume percentage (0-100)
 */
export function dbToVolume(db: number): number {
	if (!Number.isFinite(db)) return 0
	const clamped = clampDb(db)
	if (clamped === Number.NEGATIVE_INFINITY) return 0
	const linear = 10 ** (db / 20)
	return Math.max(0, Math.round(linear * 100))
}

/**
 * Format dB value for display
 */
export function formatDb(db: number, precision = 1): string {
	if (!Number.isFinite(db)) return "-∞ dB"
	const rounded = Math.round(db * 10 ** precision) / 10 ** precision
	const sign = rounded > 0 ? "+" : ""
	return `${sign}${rounded.toFixed(precision)} dB`
}

/**
 * Clamp dB to track volume range
 */
export function clampDb(db: number): number {
	if (!Number.isFinite(db)) return Number.NEGATIVE_INFINITY
	return Math.min(VOLUME_MAX_DB, Math.max(VOLUME_MIN_DB, db))
}

/**
 * Convert envelope multiplier (0-4) to dB
 */
export function multiplierToDb(multiplier: number): number {
	if (!Number.isFinite(multiplier) || multiplier <= 0) {
		return Number.NEGATIVE_INFINITY
	}
	return 20 * Math.log10(multiplier)
}

/**
 * Convert dB to envelope multiplier (0-4)
 */
export function dbToMultiplier(db: number): number {
	if (!Number.isFinite(db)) return 0
	return 10 ** (db / 20)
}

/**
 * Clamp dB to automation range
 */
export function clampAutomationDb(db: number): number {
	if (!Number.isFinite(db)) return Number.NEGATIVE_INFINITY
	return Math.min(AUTOMATION_MAX_DB, Math.max(AUTOMATION_MIN_DB, db))
}

/**
 * Get effective dB combining base volume and envelope multiplier
 */
export function getEffectiveDb(
	baseVolumePercent: number,
	envelopeMultiplier: number,
): number {
	const baseDb = volumeToDb(baseVolumePercent)
	const envelopeDb = multiplierToDb(envelopeMultiplier)

	if (!Number.isFinite(baseDb) || !Number.isFinite(envelopeDb)) {
		return Number.NEGATIVE_INFINITY
	}

	return baseDb + envelopeDb
}

/**
 * Format effective gain for display
 */
export function formatEffectiveDb(
	baseVolumePercent: number,
	envelopeMultiplier: number,
	precision = 1,
): string {
	const effectiveDb = getEffectiveDb(baseVolumePercent, envelopeMultiplier)
	return formatDb(effectiveDb, precision)
}
