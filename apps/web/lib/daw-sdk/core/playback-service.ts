"use client";

import { automation, volume } from "@wav0/daw-sdk";
import { z } from "zod";
import type {
	Clip,
	PlaybackOptions,
	Track,
	TrackEnvelope,
} from "../types/schemas";
import {
	AUTOMATION_CANCEL_LOOKAHEAD_SEC,
	AUTOMATION_SCHEDULING_EPSILON_SEC,
	MAX_AUTOMATION_CURVE_DURATION_SEC,
	MIN_AUTOMATION_SEGMENT_DURATION_SEC,
} from "./audio-scheduling-constants";
import { audioService } from "./audio-service";

type ClipPlaybackState = {
	iterator: AsyncIterableIterator<{
		buffer: AudioBuffer;
		timestamp: number;
	}> | null;
	gainNode: GainNode | null;
	audioSources: AudioBufferSourceNode[];
	generation: number;
};

type TrackPlaybackState = {
	clipStates: Map<string, ClipPlaybackState>;
	envelopeGainNode: GainNode | null;
	muteSoloGainNode: GainNode | null;
	isPlaying: boolean;
	automationGeneration: number;
	lastEnvelopeDesc?: string;
	lastAutomationEndTime?: number;
};

/**
 * PlaybackService - Core audio playback engine with MediaBunny
 *
 * Architecture:
 * - Singleton pattern for global playback state
 * - Per-clip iterator-based scheduling for multi-clip tracks
 * - Dual gain chain: envelope automation + mute/solo control
 * - Time-accurate scheduling with AudioContext
 *
 * Gain Chain: clipGain → envelopeGain → muteSoloGain → master
 */
export class PlaybackService {
	private static instance: PlaybackService;
	private audioContext: AudioContext | null = null;
	private masterGainNode: GainNode | null = null;
	private masterAnalyser: AnalyserNode | null = null;
	private meterDataArray: Float32Array | null = null;
	private currentMasterDb = Number.NEGATIVE_INFINITY;
	private meterUpdateInterval: number | null = null;
	private tracks = new Map<string, TrackPlaybackState>();
	private isPlaying = false;
	private startTime = 0;
	private playbackTimeAtStart = 0;
	private options: PlaybackOptions = {};
	private animationFrameId: number | null = null;
	private queuedAudioNodes = new Set<AudioBufferSourceNode>();
	private nodeStartTimes = new WeakMap<AudioBufferSourceNode, number>();
	private trackMuteState = new Map<string, boolean>();
	private currentTracks = new Map<string, Track>();
	// Global clip registry: enforces one-track-per-clip ownership
	private activeClips = new Map<
		string,
		{
			trackId: string;
			clipState: ClipPlaybackState;
			desc: string;
			generation: number;
		}
	>();
	// Serialization mutex for all sync operations
	private syncLock: Promise<void> = Promise.resolve();
	private lastScheduleLeadMs = 0;
	private static readonly START_GRACE_SEC = 0.0125;

	private constructor() {}

	private queueSync<T>(fn: () => Promise<T>): Promise<T> {
		const queued = this.syncLock.then(
			() => fn(),
			() => fn(),
		);
		this.syncLock = queued.then(
			() => {},
			() => {},
		);
		return queued;
	}

	private describeClip(clip: Clip): string {
		return `${clip.startTime}|${clip.trimStart}|${clip.trimEnd}|${clip.loop ? "1" : "0"}|${clip.loopEnd ?? -1}`;
	}

	private describeEnvelope(env?: TrackEnvelope): string {
		if (!env || !env.points?.length) return "";
		const pts = env.points.map((p) => `${p.time}:${p.value}`).join(",");
		const segs = (env.segments ?? [])
			.map((s) => `${s.fromPointId}->${s.toPointId}:${s.curve ?? "0"}`)
			.join(",");
		return `${pts}#${segs}`;
	}

	static getInstance(): PlaybackService {
		if (!PlaybackService.instance) {
			PlaybackService.instance = new PlaybackService();
		}
		return PlaybackService.instance;
	}

	private async getAudioContext(): Promise<AudioContext> {
		if (!this.audioContext) {
			this.audioContext = await audioService.getAudioContext();
			this.masterGainNode = this.audioContext.createGain();

			// Create analyser for master metering
			this.masterAnalyser = this.audioContext.createAnalyser();
			this.masterAnalyser.fftSize = 2048;
			this.masterAnalyser.smoothingTimeConstant = 0.8;
			this.meterDataArray = new Float32Array(
				this.masterAnalyser.fftSize,
			) as Float32Array;

			// Chain: masterGain → analyser → destination
			this.masterGainNode.connect(this.masterAnalyser);
			this.masterAnalyser.connect(this.audioContext.destination);
		}
		return this.audioContext;
	}

	/**
	 * Get current playback time with high precision
	 * Uses AudioContext.currentTime which provides sub-millisecond accuracy
	 * and is synchronized with the audio hardware clock
	 */
	private getPlaybackTime(): number {
		if (this.isPlaying && this.audioContext) {
			return (
				this.audioContext.currentTime -
				this.startTime +
				this.playbackTimeAtStart
			);
		}
		return this.playbackTimeAtStart;
	}

	async stopClip(_trackId: string, clipId: string): Promise<void> {
		// Alias to global stop to prevent bypassing registry
		await this.stopClipGlobal(clipId);
	}

	/**
	 * Stop clip globally (removes from global registry)
	 * Ensures clip audio fully disconnects before removal
	 */
	private async stopClipGlobal(clipId: string): Promise<void> {
		const active = this.activeClips.get(clipId);
		if (!active) return;

		const clipState = active.clipState;
		// Micro-fade out to avoid clicks when stopping during playback
		try {
			if (this.audioContext && clipState.gainNode) {
				const now = this.audioContext.currentTime;
				clipState.gainNode.gain.cancelScheduledValues(now);
				clipState.gainNode.gain.setValueAtTime(
					clipState.gainNode.gain.value,
					now,
				);
				clipState.gainNode.gain.linearRampToValueAtTime(0, now + 0.005);
			}
		} catch {}

		// Stop iterator
		try {
			if (clipState.iterator?.return) {
				await clipState.iterator.return();
			}
		} catch (error) {
			console.warn("Failed to close clip iterator", clipId, error);
		}
		clipState.iterator = null;
		clipState.generation = (clipState.generation ?? 0) + 1;

		// Stop all audio sources (after short fade window)
		for (const node of clipState.audioSources) {
			try {
				node.stop(
					this.audioContext ? this.audioContext.currentTime + 0.006 : undefined,
				);
				node.disconnect();
			} catch (error) {
				console.warn("Failed to stop audio source", clipId, error);
			}
		}
		clipState.audioSources = [];

		// Disconnect gain node
		if (clipState.gainNode) {
			try {
				clipState.gainNode.disconnect();
			} catch (error) {
				console.warn("Failed to disconnect clip gain", clipId, error);
			}
			clipState.gainNode = null;
		}

		this.activeClips.delete(clipId);

		for (const trackState of this.tracks.values()) {
			trackState.clipStates.delete(clipId);
		}
	}

	/**
	 * Start clip globally (adds to global registry)
	 * Creates gain chain and schedules audio playback
	 */
	private async startClipGlobal(
		clip: Clip,
		track: Track,
		trackState: TrackPlaybackState,
	): Promise<void> {
		if (!this.audioContext || !clip.opfsFileId) return;

		// Create clip-level gain node for fades
		const gainNode = this.audioContext.createGain();
		if (trackState.envelopeGainNode) {
			gainNode.connect(trackState.envelopeGainNode);
		}

		const generation = 0;
		const clipState: ClipPlaybackState = {
			iterator: null,
			gainNode,
			audioSources: [],
			generation,
		};

		// Micro-fade in when starting during playback to avoid edge clicks
		try {
			const now = this.audioContext.currentTime;
			gainNode.gain.cancelScheduledValues(now);
			const initial = this.isPlaying ? 0 : gainNode.gain.value;
			gainNode.gain.setValueAtTime(initial, now);
			if (this.isPlaying) {
				gainNode.gain.linearRampToValueAtTime(1, now + 0.005);
			}
		} catch {}

		// Register globally BEFORE scheduling audio
		const desc = this.describeClip(clip);
		this.activeClips.set(clip.id, {
			trackId: track.id,
			clipState,
			desc,
			generation,
		});

		// Schedule audio using existing logic
		await this.scheduleClipWithState(track, clip, trackState, clipState);
	}

	private cancelGainAutomation(gain: AudioParam, atTime: number): void {
		gain.cancelScheduledValues(atTime);
		gain.setValueAtTime(gain.value, atTime);
	}

	/**
	 * Central automation rescheduler - all automation mutations funnel through here
	 * Enforces:
	 * 1. cancelScheduledValues(now) to clear existing schedules
	 * 2. setValueAtTime(gain.value, now) to anchor current value
	 * 3. Schedule only future segments relative to transport
	 * 4. No setValueCurveAtTime overlaps
	 * 5. Generation token to drop late schedules
	 */
	private rescheduleTrackAutomation(track: Track, generation?: number): void {
		if (!this.audioContext || !this.masterGainNode) return;
		const state = this.tracks.get(track.id);
		if (!state?.envelopeGainNode) return;

		// Check generation token to drop late schedules
		if (generation !== undefined && generation !== state.automationGeneration) {
			return;
		}

		const envelope = track.volumeEnvelope;
		const envelopeGain = state.envelopeGainNode;
		const now = this.audioContext.currentTime;

		// Always cancel from now - MAX_CURVE_DURATION to ensure all active curves are canceled
		// This is critical during rapid reschedules (e.g., dragging clips) - curves from previous
		// schedules must be fully canceled regardless of their duration to prevent overlaps
		const cancelFrom = Math.max(0, now - MAX_AUTOMATION_CURVE_DURATION_SEC);
		envelopeGain.gain.cancelScheduledValues(cancelFrom);
		
		// Reset automation tracking to now after cancellation for clean scheduling state
		state.lastAutomationEndTime = now;

		// Step 2: Anchor to instantaneous effective gain at current transport time
		const currentTimeMs = this.getPlaybackTime() * 1000;
		const baseVolumeDb =
			track.volumeDb ?? volume.volumeToDb(track.volume ?? 75);
		const baseVolume = volume.dbToGain(baseVolumeDb);
		const multiplier = automation.evaluateEnvelopeGainAt(
			envelope,
			currentTimeMs,
		);
		const anchorGain = baseVolume * multiplier;
		envelopeGain.gain.setValueAtTime(anchorGain, now);

		if (!envelope || !envelope.enabled || envelope.points.length === 0) {
			envelopeGain.gain.setValueAtTime(baseVolume, now);
			return;
		}

		const sorted = [...envelope.points].sort((a, b) => a.time - b.time);

		// Find current multiplier at playback position with proper interpolation
		let currentMultiplier = 1.0;
		let prevPoint: (typeof sorted)[0] | null = null;
		let nextPoint: (typeof sorted)[0] | null = null;

		for (let i = 0; i < sorted.length; i++) {
			const point = sorted[i];
			if (point.time <= currentTimeMs) {
				currentMultiplier = point.value;
				prevPoint = point;
				nextPoint = sorted[i + 1] || null;
			} else {
				nextPoint = point;
				break;
			}
		}

		// If we're between two points, interpolate with curve
		if (prevPoint && nextPoint && currentTimeMs < nextPoint.time) {
			const segment = envelope.segments?.find(
				(seg) =>
					seg.fromPointId === prevPoint.id && seg.toPointId === nextPoint.id,
			);
			const t =
				(currentTimeMs - prevPoint.time) / (nextPoint.time - prevPoint.time);
			const curve = segment?.curve ?? 0;

			const curvedT =
				curve === 0
					? t
					: curve < 0
						? t ** (1 + (Math.abs(curve) / 99) * 3)
						: 1 - (1 - t) ** (1 + (curve / 99) * 3);

			currentMultiplier =
				prevPoint.value + (nextPoint.value - prevPoint.value) * curvedT;
		}

		// Step 3: Schedule only future segments relative to transport
		const futurePoints = sorted.filter((point) => point.time > currentTimeMs);
		if (futurePoints.length === 0) {
			// No future points, set constant gain (only if different from current)
			const targetGain = baseVolume * currentMultiplier;
			if (Math.abs(envelopeGain.gain.value - targetGain) > 0.00001) {
				envelopeGain.gain.setValueAtTime(targetGain, now);
			}
			return;
		}

		// Set initial value only if different from current (avoid redundant calls)
		const initialGain = baseVolume * currentMultiplier;
		if (Math.abs(envelopeGain.gain.value - initialGain) > 0.00001) {
			envelopeGain.gain.setValueAtTime(initialGain, now);
		}

		let lastMultiplier = currentMultiplier;
		let lastTime = currentTimeMs;

		const schedulingEpsilon = AUTOMATION_SCHEDULING_EPSILON_SEC;
		// After cancellation, scheduling always starts from now
		let lastScheduledEnd = now;
		for (const point of futurePoints) {
			const segmentStart = lastTime;
			const segmentEnd = point.time;

			if (segmentEnd <= segmentStart) {
				lastTime = point.time;
				lastMultiplier = point.value;
				continue;
			}

			const durationSec = (segmentEnd - segmentStart) / 1000;
			if (durationSec < MIN_AUTOMATION_SEGMENT_DURATION_SEC) {
				lastTime = point.time;
				lastMultiplier = point.value;
				continue;
			}

			const steps = Math.max(2, Math.ceil(durationSec * 60));
			const values = new Float32Array(steps);

			// Find the segment connecting the previous point to this point
			const previousPoint = sorted.find((p) => p.time === lastTime);
			const currentSegment = envelope.segments?.find(
				(seg) =>
					seg.fromPointId === previousPoint?.id && seg.toPointId === point.id,
			);
			const curveValue = currentSegment?.curve ?? 0;

			for (let i = 0; i < steps; i++) {
				const t = i / (steps - 1);
				const curvedT =
					curveValue === 0
						? t
						: curveValue < 0
							? t ** (1 + (Math.abs(curveValue) / 99) * 3)
							: 1 - (1 - t) ** (1 + (curveValue / 99) * 3);
				const multiplier =
					lastMultiplier + (point.value - lastMultiplier) * curvedT;
				values[i] = baseVolume * multiplier;
			}

			const acStart = now + (segmentStart - currentTimeMs) / 1000;
			let adjustedStart = acStart;
			if (adjustedStart < lastScheduledEnd + schedulingEpsilon) {
				adjustedStart = lastScheduledEnd + schedulingEpsilon;
			}
			// Safety check: ensure adjustedStart is >= now to prevent scheduling in the past
			// This prevents overlaps with any curves that might not have been fully canceled
			if (adjustedStart < now) {
				adjustedStart = now + schedulingEpsilon;
			}
			const adjustedDuration = durationSec - (adjustedStart - acStart);
			if (adjustedDuration <= schedulingEpsilon) {
				lastTime = point.time;
				lastMultiplier = point.value;
				continue;
			}
			const safeDuration = Math.max(adjustedDuration, schedulingEpsilon);
			envelopeGain.gain.setValueCurveAtTime(
				values,
				adjustedStart,
				safeDuration,
			);
			lastScheduledEnd = adjustedStart + safeDuration;

			lastTime = point.time;
			lastMultiplier = point.value;
		}
		state.lastAutomationEndTime = lastScheduledEnd;
	}

	/**
	 * Update track volume during playback without disrupting automation
	 * Scales the base volume that automation multiplies against
	 */
	updateTrackVolumeRealtime(trackId: string, volumeDb: number): void {
		if (!this.audioContext || !this.masterGainNode) return;

		const state = this.tracks.get(trackId);
		if (!state?.envelopeGainNode) return;

		// Store the new base volume in currentTracks for next schedule
		const currentTrack = this.currentTracks.get(trackId);
		if (currentTrack) {
			currentTrack.volumeDb = volumeDb;
		}

		// Increment generation to invalidate any pending schedules
		state.automationGeneration++;

		// Reschedule using centralized rescheduler
		if (currentTrack) {
			this.rescheduleTrackAutomation(currentTrack, state.automationGeneration);
		}
	}

	/**
	 * Start real-time master meter updates
	 */
	private startMeterUpdates(): void {
		if (this.meterUpdateInterval) return;

		this.meterUpdateInterval = window.setInterval(() => {
			this.updateMeterReading();
		}, 50); // Update at 20Hz
	}

	/**
	 * Stop real-time master meter updates
	 */
	private stopMeterUpdates(): void {
		if (this.meterUpdateInterval) {
			clearInterval(this.meterUpdateInterval);
			this.meterUpdateInterval = null;
		}
	}

	/**
	 * Update master meter reading from analyser
	 */
	private updateMeterReading(): void {
		if (!this.masterAnalyser || !this.meterDataArray) return;

		// @ts-expect-error - Float32Array type mismatch between ArrayBufferLike and ArrayBuffer
		this.masterAnalyser.getFloatTimeDomainData(this.meterDataArray);

		// Calculate RMS
		let sumSquares = 0;
		for (let i = 0; i < this.meterDataArray.length; i++) {
			sumSquares += this.meterDataArray[i] ** 2;
		}
		const rms = Math.sqrt(sumSquares / this.meterDataArray.length);

		// Convert to dB
		this.currentMasterDb =
			rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY;
	}

	/**
	 * Get current master output level in dB
	 */
	getMasterDb(): number {
		return this.currentMasterDb;
	}

	getLastScheduleLeadMs(): number {
		return this.lastScheduleLeadMs;
	}

	private applySnapshot(tracks: Track[]): void {
		if (!this.audioContext || !this.masterGainNode) return;
		const soloEngaged = tracks.some((track) => track.soloed);
		for (const track of tracks) {
			const state = this.tracks.get(track.id);
			if (!state) continue;

			if (!state.envelopeGainNode) {
				state.envelopeGainNode = this.audioContext.createGain();
			}
			if (!state.muteSoloGainNode) {
				state.muteSoloGainNode = this.audioContext.createGain();
				state.envelopeGainNode.connect(state.muteSoloGainNode);
				state.muteSoloGainNode.connect(this.masterGainNode);
			}

			// Detect envelope changes and bump automation generation
			const desc = this.describeEnvelope(track.volumeEnvelope);
			if (state.lastEnvelopeDesc !== desc) {
				state.automationGeneration++;
				state.lastEnvelopeDesc = desc;
			}

			const muted = Boolean(track.muted) || (soloEngaged && !track.soloed);
			this.trackMuteState.set(track.id, muted);
			state.muteSoloGainNode.gain.value = muted ? 0 : 1;
			this.rescheduleTrackAutomation(track, state.automationGeneration);
			state.isPlaying = !muted;
		}
		this.currentTracks = new Map(tracks.map((track) => [track.id, track]));
	}

	private refreshMix(): void {
		if (this.currentTracks.size === 0) return;
		const tracks = Array.from(this.currentTracks.values());
		if (this.isPlaying && this.audioContext) {
			this.queueSync(async () => {
				this.applySnapshot(tracks);
			}).catch((err) => {
				console.error("Failed to refresh mix during playback:", err);
			});
		} else {
			this.applySnapshot(tracks);
		}
	}

	async synchronizeTracks(tracks: Track[]): Promise<void> {
		if (this.isPlaying && this.audioContext) {
			// Atomic: snapshot + clip sync under mutex to avoid gaps
			await this.queueSync(async () => {
				this.applySnapshot(tracks);
				await this.synchronizeClipsGlobal(tracks);
			}).catch((err) => {
				console.error("Failed to synchronize tracks during playback:", err);
			});
			return;
		}
		// Not playing: just apply snapshot
		this.applySnapshot(tracks);
	}

	/**
	 * Synchronize clips using global registry
	 * Sequential: await all stops, then fire all starts
	 */
	private async synchronizeClipsGlobal(tracks: Track[]): Promise<void> {
		if (!this.audioContext) return;

		// Build desired state from REAL clips only (no synthetic opfs fallbacks)
		const desiredState = new Map<
			string,
			{ clip: Clip; trackId: string; desc: string }
		>();
		for (const track of tracks) {
			const clips = track.clips ?? [];
			for (const clip of clips) {
				if (!clip.opfsFileId) continue;
				const desc = this.describeClip(clip);
				desiredState.set(clip.id, { clip, trackId: track.id, desc });
			}
		}

		// Phase 1: Stop clips that shouldn't be playing, are on wrong track, or have changed params
		// This handles:
		// - Clips that were removed (!desired) - including original clips that were split
		// - Clips that moved tracks (desired.trackId !== active.trackId)
		// - Clips that changed position/trim/loop (desired.desc !== active.desc)
		const stopsNeeded: string[] = [];
		for (const [clipId, active] of this.activeClips) {
			const desired = desiredState.get(clipId);
			if (
				!desired ||
				desired.trackId !== active.trackId ||
				desired.desc !== active.desc
			) {
				stopsNeeded.push(clipId);
			}
		}

		// Await all stops to prevent race conditions
		await Promise.all(stopsNeeded.map((clipId) => this.stopClipGlobal(clipId)));

		// Phase 2: Start clips that should be playing but aren't (or changed)
		const startsNeeded: Array<{ clip: Clip; trackId: string }> = [];
		for (const [clipId, { clip, trackId, desc }] of desiredState) {
			const active = this.activeClips.get(clipId);
			if (!active || active.trackId !== trackId || active.desc !== desc) {
				const trackState = this.tracks.get(trackId);
				if (trackState) {
					startsNeeded.push({ clip, trackId });
				}
			}
		}

		// Fire all starts (can be parallel after stops complete)
		await Promise.all(
			startsNeeded.map(({ clip, trackId }) => {
				const track = tracks.find((t) => t.id === trackId);
				const trackState = this.tracks.get(trackId);
				if (track && trackState) {
					return this.startClipGlobal(clip, track, trackState);
				}
				return Promise.resolve();
			}),
		);
	}

	async initializeWithTracks(tracks: Track[]): Promise<void> {
		await this.getAudioContext();
		this.tracks.clear();

		for (const track of tracks) {
			this.tracks.set(track.id, {
				clipStates: new Map(),
				envelopeGainNode: null,
				muteSoloGainNode: null,
				isPlaying: false,
				automationGeneration: 0,
			});
		}
	}

	async play(tracks: Track[], options: PlaybackOptions = {}): Promise<void> {
		// Validate options (callbacks are optional and not validated)
		const { startTime } = options;
		if (startTime !== undefined) {
			z.number().min(0).parse(startTime);
		}
		this.options = options;

		if (this.isPlaying) {
			await this.pause();
		}

		await this.getAudioContext();
		if (!this.audioContext || !this.masterGainNode) {
			throw new Error("AudioContext not initialized");
		}

		this.playbackTimeAtStart = options.startTime || 0;
		this.startTime = this.audioContext.currentTime;
		this.isPlaying = true;

		// Immediate synchronous update before audio scheduling to ensure visual sync
		const initialTime = this.getPlaybackTime();
		this.options.onTimeUpdate?.(initialTime);

		this.startMeterUpdates();
		this.applySnapshot(tracks);

		// Clear global registry before fresh play
		this.activeClips.clear();

		// Initialize track gain chains
		for (const track of tracks) {
			const trackState = this.tracks.get(track.id);
			if (!trackState) continue;

			if (!trackState.envelopeGainNode) {
				trackState.envelopeGainNode = this.audioContext.createGain();
			}
			if (!trackState.muteSoloGainNode) {
				trackState.muteSoloGainNode = this.audioContext.createGain();
				trackState.envelopeGainNode.connect(trackState.muteSoloGainNode);
				trackState.muteSoloGainNode.connect(this.masterGainNode);
			}
		}

		// Start visual update loop immediately, before audio scheduling
		// This ensures visual updates begin synchronously with playback start
		this.startTimeUpdateLoop();

		// Schedule all clips via mutex
		await this.queueSync(() => this.synchronizeClipsGlobal(tracks));
	}

	private async scheduleClipWithState(
		track: Track,
		clip: Clip,
		_trackState: TrackPlaybackState,
		cps: ClipPlaybackState,
	): Promise<void> {
		if (!this.audioContext || !this.masterGainNode) return;

		if (cps.audioSources.length > 0) {
			for (const node of cps.audioSources) {
				try {
					node.stop();
					node.disconnect();
				} catch {}
			}
			cps.audioSources = [];
		}

		let sink = audioService.getAudioBufferSink(clip.opfsFileId);
		if (!sink) {
			try {
				await audioService.loadTrackFromOPFS(
					clip.opfsFileId,
					clip.audioFileName ?? clip.name ?? "",
				);
				sink = audioService.getAudioBufferSink(clip.opfsFileId);
			} catch {}
		}
		if (!sink) return;

		// Use current timeline (seconds)
		const timelineSec = this.getPlaybackTime();

		const clipStartSec = clip.startTime / 1000;
		const clipTrimStartSec = clip.trimStart / 1000;
		const clipTrimEndSec = clip.trimEnd / 1000;
		const clipDurationSec = Math.max(0, clipTrimEndSec - clipTrimStartSec);
		const clipOneShotEndSec = clipStartSec + clipDurationSec;
		const loopUntilSec = clip.loop
			? clip.loopEnd
				? clip.loopEnd / 1000
				: Number.POSITIVE_INFINITY
			: clipOneShotEndSec;

		if (timelineSec >= loopUntilSec) return;

		let cycleOffsetSec = 0;
		let timeIntoClip = 0;
		if (clip.loop) {
			if (timelineSec <= clipStartSec) {
				timeIntoClip = 0;
				cycleOffsetSec = 0;
			} else {
				const elapsed = timelineSec - clipStartSec;
				const cycleIndex =
					clipDurationSec > 0 ? Math.floor(elapsed / clipDurationSec) : 0;
				cycleOffsetSec = cycleIndex * clipDurationSec;
				timeIntoClip = clipDurationSec > 0 ? elapsed - cycleOffsetSec : 0;
				// Guard boundary: if we're exactly at cycle end, roll to next cycle start
				if (clipDurationSec > 0 && timeIntoClip >= clipDurationSec - 1e-6) {
					cycleOffsetSec += clipDurationSec;
					timeIntoClip = 0;
				}
			}
		} else {
			timeIntoClip = Math.max(0, timelineSec - clipStartSec);
		}

		if (timeIntoClip > 0 && timeIntoClip < PlaybackService.START_GRACE_SEC) {
			timeIntoClip = 0;
		}

		const audioFileReadStart = clipTrimStartSec + timeIntoClip;
		if (audioFileReadStart >= clipTrimEndSec) return;

		// Apply fade envelopes (cancel → anchor → future-only) with generation guard
		try {
			const clipGain = cps.gainNode ?? this.masterGainNode;
			if (!clipGain || !this.audioContext) return;
			const now = this.audioContext.currentTime;
			this.cancelGainAutomation(clipGain.gain, now);

			// Anchor at current timeline gain (assume 0..1 linear, fallback 1)
			const anchorValue = 1;
			clipGain.gain.setValueAtTime(anchorValue, now);

			const clipStartAC =
				this.startTime + clipStartSec - this.playbackTimeAtStart;
			const loopEndAC =
				this.startTime + loopUntilSec - this.playbackTimeAtStart;
			const oneShotEndAC =
				this.startTime + clipOneShotEndSec - this.playbackTimeAtStart;

			if (clip.fadeIn && clip.fadeIn > 0) {
				// From 0 → 1 using curve (use linear for now; curve params available on clip)
				const startT = Math.max(now, clipStartAC);
				clipGain.gain.setValueAtTime(0, startT);
				clipGain.gain.linearRampToValueAtTime(1, startT + clip.fadeIn / 1000);
			}

			if (clip.fadeOut && clip.fadeOut > 0) {
				const targetEnd = clip.loop
					? Number.isFinite(loopUntilSec)
						? loopEndAC
						: null
					: oneShotEndAC;
				if (targetEnd !== null) {
					const startT = Math.max(now, targetEnd - clip.fadeOut / 1000);
					clipGain.gain.setValueAtTime(1, startT);
					clipGain.gain.linearRampToValueAtTime(0, Math.max(now, targetEnd));
				}
			}
		} catch (e) {
			console.warn("Failed to schedule clip fades", e);
		}

		cps.generation = (cps.generation ?? 0) + 1;
		cps.iterator = sink.buffers(audioFileReadStart, clipTrimEndSec);
		this.runClipAudioIterator(
			track,
			clip,
			cps,
			clipStartSec,
			clipTrimStartSec,
			cycleOffsetSec,
			loopUntilSec,
		);
	}

	private async runClipAudioIterator(
		track: Track,
		clip: Clip,
		cps: ClipPlaybackState,
		clipStartSec: number,
		clipTrimStartSec: number,
		cycleOffsetSec = 0,
		loopUntilSec = Number.POSITIVE_INFINITY,
	): Promise<void> {
		const myGen = cps.generation ?? 0;
		if (!cps.iterator || !this.audioContext) return;
		const clipGain = cps.gainNode;
		const clipTrimEndSec = clip.trimEnd / 1000;
		const clipDurationSec = clipTrimEndSec - clipTrimStartSec;

		try {
			for await (const { buffer, timestamp } of cps.iterator) {
				if (!this.isPlaying || myGen !== (cps.generation ?? 0)) break;

				const node = this.audioContext.createBufferSource();
				node.buffer = buffer;
				node.connect(
					clipGain ?? this.masterGainNode ?? this.audioContext.destination,
				);

				const timeInTrimmed = timestamp - clipTrimStartSec;
				const timelinePos = clipStartSec + cycleOffsetSec + timeInTrimmed;
				if (timelinePos > loopUntilSec) break;

				// Anchor to current timeline
				const now = this.audioContext.currentTime;
				const currentTl = this.getPlaybackTime();
				let leadSec = timelinePos - currentTl;
				if (leadSec >= 0) {
					leadSec = Math.max(leadSec, PlaybackService.START_GRACE_SEC);
				}
				this.lastScheduleLeadMs = leadSec * 1000;
				const startAt = now + leadSec;

				if (startAt >= now) {
					node.start(startAt);
					this.nodeStartTimes.set(node, startAt);
				} else {
					const offset = now - startAt;
					if (offset < buffer.duration) {
						const actualStart = now;
						node.start(actualStart, offset);
						this.nodeStartTimes.set(node, actualStart);
					} else {
						continue;
					}
				}

				cps.audioSources.push(node);
				this.queuedAudioNodes.add(node);
				node.onended = () => {
					const idx = cps.audioSources.indexOf(node);
					if (idx > -1) cps.audioSources.splice(idx, 1);
					this.queuedAudioNodes.delete(node);
					this.nodeStartTimes.delete(node);
				};

				const currentTimeline = this.getPlaybackTime();
				if (timelinePos - currentTimeline >= 0.25) {
					await new Promise<void>((resolve) => {
						const id = setInterval(() => {
							if (
								timelinePos - this.getPlaybackTime() < 0.25 ||
								!this.isPlaying ||
								myGen !== (cps.generation ?? 0)
							) {
								clearInterval(id);
								resolve();
							}
						}, 25);
					});
				}
			}

			// Handle loop continuation
			if (this.isPlaying && clip.loop && myGen === (cps.generation ?? 0)) {
				const sink = clip.opfsFileId
					? audioService.getAudioBufferSink(clip.opfsFileId)
					: null;
				if (sink) {
					const nextCycleStart =
						cycleOffsetSec + clipDurationSec + clipStartSec;
					if (nextCycleStart < loopUntilSec) {
						cps.generation = (cps.generation ?? 0) + 1;
						cps.iterator = sink.buffers(clipTrimStartSec, clipTrimEndSec);
						this.runClipAudioIterator(
							track,
							clip,
							cps,
							clipStartSec,
							clipTrimStartSec,
							cycleOffsetSec + clipDurationSec,
							loopUntilSec,
						);
					}
				}
			}
		} catch (e) {
			console.error("Error in clip audio iterator:", track.name, clip.name, e);
		}
	}

	private async stopAllActiveClips(): Promise<void> {
		const clipIds = Array.from(this.activeClips.keys());
		await Promise.all(clipIds.map((clipId) => this.stopClipGlobal(clipId)));
	}

	async pause(): Promise<void> {
		this.stopMeterUpdates();
		this.playbackTimeAtStart = this.getPlaybackTime();
		this.isPlaying = false;

		// Stop all clips via global registry with mutex
		await this.queueSync(() => this.stopAllActiveClips());

		// Legacy per-track cleanup (for any orphaned states)
		for (const trackState of this.tracks.values()) {
			trackState.isPlaying = false;
			for (const cps of trackState.clipStates.values()) {
				try {
					if (cps.iterator?.return) {
						await cps.iterator.return();
					}
				} catch {}
				cps.iterator = null;
				cps.generation = (cps.generation ?? 0) + 1;
				for (const node of [...cps.audioSources]) {
					try {
						node.stop();
					} catch {}
				}
				cps.audioSources = [];
			}
		}

		for (const node of this.queuedAudioNodes) {
			try {
				node.stop();
			} catch {}
		}
		this.queuedAudioNodes.clear();
		this.stopTimeUpdateLoop();
	}

	async stop(): Promise<void> {
		this.stopMeterUpdates();
		await this.pause();
		this.playbackTimeAtStart = 0;
		this.currentMasterDb = Number.NEGATIVE_INFINITY;
		this.options.onTimeUpdate?.(0);
	}

	async rescheduleTrack(
		updatedTrack: Track,
		allTracks?: Track[],
	): Promise<void> {
		// Alias to global synchronization path
		// If allTracks is provided, use it for complete state synchronization
		// Otherwise, build from currentTracks (backward compatibility)
		const tracks = allTracks
			? allTracks.map((t) => (t.id === updatedTrack.id ? updatedTrack : t))
			: Array.from(this.currentTracks.values()).map((t) =>
					t.id === updatedTrack.id ? updatedTrack : t,
				);
		await this.synchronizeTracks(tracks);
	}

	getCurrentTime(): number {
		return this.getPlaybackTime();
	}

	getIsPlaying(): boolean {
		return this.isPlaying;
	}

	private startTimeUpdateLoop(): void {
		// Stop any existing loop first
		this.stopTimeUpdateLoop();

		const updateTime = () => {
			if (!this.isPlaying) {
				this.animationFrameId = null;
				return;
			}
			// Use high-precision AudioContext time for accurate sync
			const currentTime = this.getPlaybackTime();
			this.options.onTimeUpdate?.(currentTime);
			this.animationFrameId = requestAnimationFrame(updateTime);
		};
		// Immediate synchronous call for instant visual update
		updateTime();
	}

	private stopTimeUpdateLoop(): void {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	updateTrackVolume(_trackId: string, _volume: number): void {
		this.refreshMix();
	}

	updateTrackMute(_trackId: string, _muted: boolean, _volume?: number): void {
		this.refreshMix();
	}

	updateSoloStates(tracks: Track[]): void {
		if (this.isPlaying && this.audioContext) {
			this.queueSync(async () => {
				this.applySnapshot(tracks);
			}).catch((err) => {
				console.error("Failed to update solo states during playback:", err);
			});
		} else {
			this.applySnapshot(tracks);
		}
	}

	updateMasterVolume(volumePercent: number): void {
		if (this.masterGainNode && this.audioContext) {
			// Convert volume percentage to dB, then to linear gain
			const volumeDb = volume.volumeToDb(volumePercent);
			const gain = volume.dbToGain(volumeDb);
			const now = this.audioContext.currentTime;
			this.cancelGainAutomation(this.masterGainNode.gain, now);
			this.masterGainNode.gain.setValueAtTime(gain, now);
		}
	}

	async cleanup(): Promise<void> {
		try {
			await this.stop();
		} catch (e) {
			console.error("Error while stopping during cleanup", e);
		}
		this.tracks.clear();
		this.currentTracks.clear();
		if (this.audioContext) {
			try {
				await this.audioContext.close();
			} catch (e) {
				console.error("Error closing audio context", e);
			}
			this.audioContext = null;
			this.masterGainNode = null;
		}
	}
}

export const playbackService = PlaybackService.getInstance();
