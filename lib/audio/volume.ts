export const VOLUME_MIN_DB = -30;
export const VOLUME_MAX_DB = 6;

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

export function formatDb(db: number): string {
	if (!Number.isFinite(db)) return "-∞ dB";
	const rounded = Math.round(db * 10) / 10;
	return `${rounded} dB`;
}

export function clampDb(db: number): number {
	if (!Number.isFinite(db)) return Number.NEGATIVE_INFINITY;
	return Math.min(VOLUME_MAX_DB, Math.max(VOLUME_MIN_DB, db));
}
