/**
 * Offline Renderer
 *
 * Renders tracks to an AudioBuffer using OfflineAudioContext.
 * Framework-agnostic - accepts an audio buffer provider function.
 */

import type {
	Track,
	TrackEnvelope,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
} from "../types/schemas";
import { automation } from "../utils/automation";
import { curves } from "../utils/curves";

export interface RenderOptions {
	/** Start time in milliseconds */
	startMs?: number;
	/** End time in milliseconds */
	endMs?: number;
	/** Sample rate (default: 48000) */
	sampleRate?: number;
	/** Channels (default: 2) */
	channels?: 1 | 2;
	/** Normalize to 0.95 peak (default: false) */
	normalize?: boolean;
}

export interface AudioBufferProvider {
	/** Get an AudioBuffer for a given opfsFileId */
	getAudioBuffer: (
		opfsFileId: string,
		fileName: string,
	) => Promise<AudioBuffer | null>;
}

/**
 * Render project tracks to an AudioBuffer
 */
export async function renderProjectToAudioBuffer(
	tracks: Track[],
	provider: AudioBufferProvider,
	options: RenderOptions = {},
): Promise<AudioBuffer> {
	const startMs = Math.max(0, options.startMs ?? 0);
	const endMs = Math.max(
		startMs + 1,
		options.endMs ?? computeProjectEndMs(tracks),
	);
	const sampleRate = options.sampleRate ?? 48000;
	const channels = options.channels ?? 2;
	const length = Math.ceil(((endMs - startMs) / 1000) * sampleRate);

	const ac = new OfflineAudioContext(channels, length, sampleRate);
	const master = ac.createGain();
	master.connect(ac.destination);

	for (const track of tracks) {
		const trackGain = ac.createGain();
		trackGain.connect(master);
		scheduleTrackEnvelopeInRange(
			ac,
			trackGain.gain,
			track.volumeEnvelope,
			startMs,
			endMs,
		);

		const clips = track.clips || [];
		for (const clip of clips) {
			if (!clip.opfsFileId) continue;

			const buffer = await provider.getAudioBuffer(
				clip.opfsFileId,
				clip.audioFileName ?? clip.name ?? "",
			);
			if (!buffer) continue;

			const clipGain = ac.createGain();
			clipGain.gain.value = 1;
			clipGain.connect(trackGain);

			scheduleClipInRange(
				ac,
				clipGain,
				buffer,
				clip,
				startMs / 1000,
				endMs / 1000,
			);
		}
	}

	const rendered = await ac.startRendering();
	if (options.normalize) {
		normalizeBuffer(rendered);
	}
	return rendered;
}

/**
 * Compute project end time based on clip positions
 */
function computeProjectEndMs(tracks: Track[]): number {
	let maxEnd = 0;
	for (const t of tracks) {
		const clips = t.clips || [];
		for (const c of clips) {
			const oneShotEnd =
				c.startTime + Math.max(0, (c.trimEnd ?? 0) - (c.trimStart ?? 0));
			const loopEnd = c.loop ? (c.loopEnd ?? oneShotEnd) : oneShotEnd;
			maxEnd = Math.max(maxEnd, loopEnd);
		}
	}
	return Math.max(maxEnd, 60000);
}

/**
 * Schedule track envelope automation for a range
 */
function scheduleTrackEnvelopeInRange(
	ac: BaseAudioContext,
	param: AudioParam,
	envelope: TrackEnvelope | undefined,
	rangeStartMs: number,
	rangeEndMs: number,
): void {
	param.cancelScheduledValues(0);
	if (!envelope || !envelope.enabled) return;

	// Anchor at range start
	const v0 = automation.evaluateEnvelopeGainAt(envelope, rangeStartMs);
	param.setValueAtTime(v0, 0);

	const points: TrackEnvelopePoint[] = envelope.points || [];
	if (points.length === 0) return;

	const segs: TrackEnvelopeSegment[] = envelope.segments || [];
	const sorted = [...points].sort((a, b) => a.time - b.time);

	// Track last scheduled end time to prevent overlaps
	const EPSILON_SEC = 0.001; // 1ms gap between curves
	let lastScheduledEndSec = 0;

	for (let i = 0; i < sorted.length - 1; i++) {
		const a = sorted[i];
		const b = sorted[i + 1];
		const segStartMs = Math.max(a.time, rangeStartMs);
		const segEndMs = Math.min(b.time, rangeEndMs);
		if (segEndMs - segStartMs <= 0) continue;

		const seg = segs.find(
			(s) => s.fromPointId === a.id && s.toPointId === b.id,
		);
		const curve = seg?.curve ?? 0;
		const startVal = automation.evaluateEnvelopeGainAt(envelope, segStartMs);
		const endVal = automation.evaluateEnvelopeGainAt(envelope, segEndMs);
		let relStartSec = (segStartMs - rangeStartMs) / 1000;
		let relDurSec = (segEndMs - segStartMs) / 1000;

		// Ensure no overlap with previous segment
		if (relStartSec < lastScheduledEndSec + EPSILON_SEC) {
			const adjustment = lastScheduledEndSec + EPSILON_SEC - relStartSec;
			relStartSec += adjustment;
			relDurSec -= adjustment;
		}

		// Skip if duration too short after adjustment
		if (relDurSec <= EPSILON_SEC) continue;

		const samples = Math.max(16, Math.min(256, Math.floor(relDurSec * 100)));
		const arr = new Float32Array(samples);
		for (let s = 0; s < samples; s++) {
			const t = s / (samples - 1);
			arr[s] = curves.evaluateSegmentCurve(startVal, endVal, t, curve);
		}
		param.setValueCurveAtTime(arr, relStartSec, relDurSec);
		lastScheduledEndSec = relStartSec + relDurSec;
	}
}

/**
 * Schedule a clip within a time range
 */
function scheduleClipInRange(
	ac: BaseAudioContext,
	clipGain: GainNode,
	buffer: AudioBuffer,
	clip: {
		startTime: number;
		trimStart?: number;
		trimEnd?: number;
		loop?: boolean;
		loopEnd?: number;
		fadeIn?: number;
		fadeOut?: number;
	},
	rangeStartSec: number,
	rangeEndSec: number,
): void {
	const trimStartSec = (clip.trimStart ?? 0) / 1000;
	const trimEndSec = (clip.trimEnd ?? 0) / 1000;
	const clipDurSec = Math.max(1e-6, trimEndSec - trimStartSec);
	if (clipDurSec <= 0) return;

	const clipAbsStartSec = (clip.startTime ?? 0) / 1000;
	let audibleStart = Math.max(rangeStartSec, clipAbsStartSec);
	const absoluteLoopEnd = clip.loop
		? clip.loopEnd
			? clip.loopEnd / 1000
			: Number.POSITIVE_INFINITY
		: clipAbsStartSec + clipDurSec;
	const audibleEnd = Math.min(rangeEndSec, absoluteLoopEnd);
	if (audibleEnd <= audibleStart) return;

	const scheduleTile = (
		tileStartSec: number,
		offsetSec: number,
		playDurSec: number,
		isFirst: boolean,
		isLast: boolean,
	) => {
		const node = ac.createBufferSource();
		node.buffer = buffer;
		const tileGain = ac.createGain();
		tileGain.gain.value = 1;
		node.connect(tileGain);
		tileGain.connect(clipGain);

		// Fades at boundaries only
		if (isFirst && (clip.fadeIn ?? 0) > 0) {
			const fadeSec = clip.fadeIn! / 1000;
			tileGain.gain.cancelScheduledValues(tileStartSec);
			tileGain.gain.setValueAtTime(0, tileStartSec);
			tileGain.gain.linearRampToValueAtTime(
				1,
				tileStartSec + Math.min(fadeSec, playDurSec),
			);
		}
		if (isLast && (clip.fadeOut ?? 0) > 0) {
			const fadeSec = clip.fadeOut! / 1000;
			const foStart = Math.max(
				tileStartSec,
				tileStartSec + playDurSec - fadeSec,
			);
			tileGain.gain.cancelScheduledValues(foStart);
			tileGain.gain.setValueAtTime(1, foStart);
			tileGain.gain.linearRampToValueAtTime(0, tileStartSec + playDurSec);
		}

		node.start(tileStartSec, offsetSec, playDurSec);
	};

	// First tile (align to clip cycle when looping)
	let cycleOffset = 0;
	if (clip.loop && audibleStart > clipAbsStartSec) {
		const delta = audibleStart - clipAbsStartSec;
		cycleOffset = delta % clipDurSec;
	}
	let offsetSec = trimStartSec + cycleOffset;

	// If cycleOffset nearly equals clipDurSec, skip to next cycle
	if (cycleOffset > clipDurSec - 1e-6) {
		audibleStart += clipDurSec - cycleOffset;
		cycleOffset = 0;
		offsetSec = trimStartSec;
	}

	let playDurSec = Math.min(
		clipDurSec - cycleOffset,
		audibleEnd - audibleStart,
	);
	if (playDurSec > 1e-6) {
		const isLastFirst =
			!clip.loop || audibleStart + playDurSec >= audibleEnd - 1e-6;
		scheduleTile(audibleStart, offsetSec, playDurSec, true, isLastFirst);
	}

	if (!clip.loop) return;

	// Remaining tiles
	let nextTileStart = audibleStart + Math.max(playDurSec, 0);
	while (nextTileStart < audibleEnd - 1e-6) {
		offsetSec = trimStartSec;
		playDurSec = Math.min(clipDurSec, audibleEnd - nextTileStart);
		if (playDurSec <= 1e-6) break;
		const isLast = nextTileStart + playDurSec >= audibleEnd - 1e-6;
		scheduleTile(nextTileStart, offsetSec, playDurSec, false, isLast);
		nextTileStart += playDurSec;
		if (clip.loopEnd && nextTileStart >= clip.loopEnd / 1000) break;
	}
}

/**
 * Normalize an AudioBuffer to 0.95 peak
 * Scales both quiet (peak < 1) and clipped (peak > 1) audio
 */
function normalizeBuffer(buffer: AudioBuffer): void {
	let peak = 0;
	for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
		const data = buffer.getChannelData(ch);
		for (let i = 0; i < data.length; i++) {
			peak = Math.max(peak, Math.abs(data[i]));
		}
	}
	if (peak > 0) {
		const scale = 0.95 / peak;
		for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
			const data = buffer.getChannelData(ch);
			for (let i = 0; i < data.length; i++) {
				data[i] *= scale;
			}
		}
	}
}
