/**
 * Transport - MediaBunny-inspired playback engine
 *
 * Architecture:
 * - Iterator-based scheduling for precise timing
 * - Event-driven state management
 * - Supports clips with gain, fades, and offsets
 * - Dual gain chain: clip gain → envelope → mute/solo → master
 * - Generation tokens prevent late audio scheduling
 * - Full volume automation with curve interpolation
 */

import type { TransportEvent, TransportState } from "../types/core";
import type { Clip, Track, TrackEnvelope } from "../types/schemas";
import { automation } from "../utils/automation";
import { volume } from "../utils/volume";
import type { AudioEngine } from "./audio-engine";
import {
	AUTOMATION_CANCEL_LOOKAHEAD_SEC,
	AUTOMATION_SCHEDULING_EPSILON_SEC,
	MAX_AUTOMATION_CURVE_DURATION_SEC,
	MIN_AUTOMATION_SEGMENT_DURATION_SEC,
	START_GRACE_SEC,
} from "./audio-scheduling-constants";

/**
 * Per-clip scheduling state
 */
interface ClipScheduleState {
	/** Generation token - increments on each schedule to prevent late audio */
	generation: number;
	/** Clip-level gain node (for fades and clip gain) */
	clipGainNode: GainNode;
	/** Active audio source nodes */
	audioSources: AudioBufferSourceNode[];
}

/**
 * Per-track state for gain chain management
 */
interface TrackState {
	/** Envelope gain node (for volume automation) */
	envelopeGainNode: GainNode;
	/** Mute/solo gain node (for mute and solo control) */
	muteSoloGainNode: GainNode;
	/** Clip states belonging to this track */
	clipStates: Map<string, ClipScheduleState>;
	/** Generation token for automation scheduling */
	automationGeneration: number;
	/** Last envelope description for change detection */
	lastEnvelopeDesc?: string;
	/** Last automation end time in AudioContext time */
	lastAutomationEndTime?: number;
	/** Track is playing (not muted/soloed out) */
	isPlaying: boolean;
}

export class Transport extends EventTarget {
	private state: TransportState = "stopped";
	private playbackStartTime = 0;
	private contextStartTime = 0;
	private activeNodes = new Set<AudioBufferSourceNode>();
	/** Track clip schedule states by clip ID */
	private clipStates = new Map<string, ClipScheduleState>();
	/** Track states by track ID */
	private trackStates = new Map<string, TrackState>();
	/** Mapping of clip ID to track ID for routing */
	private clipToTrackMap = new Map<string, string>();
	/** Master bus gain node */
	private masterGainNode: GainNode | null = null;
	/** Master bus analyser node for metering */
	private masterAnalyser: AnalyserNode | null = null;
	/** RAF loop for time updates */
	private timeUpdateLoop: number | null = null;
	/** Current tracks for automation reference during playback */
	private currentTracks = new Map<string, Track>();
	/** Track mute state cache */
	private trackMuteState = new Map<string, boolean>();
	/** Global active clips registry for diff-based synchronization */
	private activeClips = new Map<
		string,
		{ trackId: string; desc: string; generation: number }
	>();
	/** Mutex lock for atomic sync operations */
	private syncLock: Promise<void> = Promise.resolve();
	/** Time when playback was paused (for resume) */
	private pausedTime = 0;
	/** Tracks snapshot for resume */
	private pausedTracks: Track[] = [];

	constructor(
		private audioEngine: AudioEngine,
		private audioContext: AudioContext,
	) {
		super();

		// Initialize master bus
		this.masterGainNode = this.audioContext.createGain();
		this.masterAnalyser = this.audioContext.createAnalyser();
		this.masterGainNode.connect(this.masterAnalyser);
		this.masterAnalyser.connect(this.audioContext.destination);
	}

	// Overload signatures
	async play(tracks: Track[], fromTime?: number): Promise<void>;
	async play(clips: Clip[], fromTime: number): Promise<void>;
	// Implementation
	async play(
		tracksOrClips: Track[] | Clip[],
		fromTime: number = 0,
	): Promise<void> {
		if (this.state === "playing") return;

		this.stop(); // Clear any existing playback
		this.activeClips.clear(); // Clear global clip registry for fresh play
		this.state = "playing";
		this.playbackStartTime = fromTime;
		this.contextStartTime = this.audioContext.currentTime;

		// Check if tracks or clips
		if (tracksOrClips.length > 0 && "clips" in tracksOrClips[0]) {
			// It's tracks - extract clips and use track-based play
			const tracks = tracksOrClips as Track[];
			await this.initializeWithTracks(tracks);

			// Build clip-to-track mapping
			this.clipToTrackMap.clear();
			const clips: Clip[] = [];
			for (const track of tracks) {
				if (track.clips) {
					for (const clip of track.clips) {
						this.clipToTrackMap.set(clip.id, track.id);
						clips.push(clip);
					}
				}
			}

			// Use clips-based play
			await this.playClips(clips, fromTime);
		} else {
			// It's clips - clear mapping (no track routing)
			this.clipToTrackMap.clear();
			const clips = tracksOrClips as Clip[];
			await this.playClips(clips, fromTime);
		}
	}

	private async playClips(clips: Clip[], fromTime: number): Promise<void> {
		// Schedule all clips and register in global registry
		for (const clip of clips) {
			const trackId = this.clipToTrackMap.get(clip.id);
			if (trackId && clip.opfsFileId) {
				this.activeClips.set(clip.id, {
					trackId,
					desc: this.describeClip(clip),
					generation: 0,
				});
			}
			this.scheduleClip(clip, fromTime);
		}

		this.dispatchEvent(
			new CustomEvent<TransportEvent>("transport", {
				detail: {
					type: "play",
					state: "playing",
					currentTime: fromTime,
					timestamp: fromTime,
				},
			}),
		);

		// Start time update loop
		this.startTimeUpdateLoop();
	}

	private async scheduleClip(clip: Clip, playbackStart: number): Promise<void> {
		const now = this.audioContext.currentTime;
		const timelineSec = playbackStart / 1000;

		// Get or create clip schedule state
		let clipState = this.clipStates.get(clip.id);
		if (!clipState) {
			clipState = {
				generation: 0,
				clipGainNode: this.audioContext.createGain(),
				audioSources: [],
			};

			// Route through track gain chain if track exists, otherwise direct to destination
			const trackId = this.clipToTrackMap.get(clip.id);
			if (trackId) {
				const trackState = this.trackStates.get(trackId);
				if (trackState) {
					// Route: clipGain → envelopeGain → muteSoloGain → destination (master added in Phase 3)
					clipState.clipGainNode.connect(trackState.envelopeGainNode);
				} else {
					// Fallback: direct to destination if track not found
					clipState.clipGainNode.connect(this.audioContext.destination);
				}
			} else {
				// No track association: direct to destination (legacy clips-only mode)
				clipState.clipGainNode.connect(this.audioContext.destination);
			}

			this.clipStates.set(clip.id, clipState);
		}

		// Stop any existing audio sources for this clip
		for (const source of clipState.audioSources) {
			try {
				source.stop();
				source.disconnect();
			} catch {
				// Ignore errors from already-stopped nodes
			}
		}
		clipState.audioSources = [];

		// Increment generation token to prevent late scheduling
		clipState.generation = (clipState.generation ?? 0) + 1;
		const thisGeneration = clipState.generation;

		// Calculate clip timing
		const clipStartSec = clip.startTime / 1000;
		const clipTrimStartSec = clip.trimStart / 1000;
		const clipTrimEndSec = (clip.trimStart + clip.sourceDurationMs) / 1000;
		const clipDurationSec = clipTrimEndSec - clipTrimStartSec;
		const clipOneShotEndSec = clipStartSec + clipDurationSec;

		// Determine loop end boundary
		const loopUntilSec = clip.loop
			? clip.loopEnd
				? clip.loopEnd / 1000
				: Number.POSITIVE_INFINITY
			: clipOneShotEndSec;

		// Check if playback position is past this clip's end
		if (timelineSec >= loopUntilSec) return;

		// Calculate time into clip (with looping logic)
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
			// For non-looping clips, still calculate cycle position if we're past one-shot end
			// This allows the current "phantom cycle" to finish when loop is disabled mid-playback
			const elapsed = Math.max(0, timelineSec - clipStartSec);
			if (elapsed > clipDurationSec && clipDurationSec > 0) {
				// We're past one-shot end - calculate position within current cycle
				// to allow the current iteration to finish
				const cycleIndex = Math.floor(elapsed / clipDurationSec);
				cycleOffsetSec = cycleIndex * clipDurationSec;
				timeIntoClip = elapsed - cycleOffsetSec;
			} else {
				timeIntoClip = elapsed;
			}
		}

		// Apply start grace period
		if (timeIntoClip > 0 && timeIntoClip < START_GRACE_SEC) {
			timeIntoClip = 0;
		}

		// Calculate audio file read position
		const audioFileReadStart = clipTrimStartSec + timeIntoClip;
		if (audioFileReadStart >= clipTrimEndSec) return;

		// Calculate clip timing in AudioContext time using original play reference
		const clipStartAC =
			this.contextStartTime + (clip.startTime - this.playbackStartTime) / 1000;
		const loopEndAC =
			this.contextStartTime +
			(loopUntilSec * 1000 - this.playbackStartTime) / 1000;
		const oneShotEndAC =
			this.contextStartTime +
			(clipOneShotEndSec * 1000 - this.playbackStartTime) / 1000;

		// Apply fade envelopes (cancel → anchor → future-only) with generation guard
		try {
			const clipGain = clipState.clipGainNode;
			if (!clipGain) return;

			// Cancel any previous automation on this gain node
			const cancelFrom = Math.max(0, now - AUTOMATION_CANCEL_LOOKAHEAD_SEC);
			clipGain.gain.cancelScheduledValues(cancelFrom);
			clipGain.gain.setValueAtTime(1, now);

			// Apply fadeIn
			if (clip.fadeIn && clip.fadeIn > 0) {
				// From 0 → 1 using curve (use linear for now; curve params available on clip)
				const startT = Math.max(now, clipStartAC);
				clipGain.gain.setValueAtTime(0, startT);
				clipGain.gain.linearRampToValueAtTime(1, startT + clip.fadeIn / 1000);
			}

			// Apply fadeOut
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

		// Run the audio iterator loop with loop continuation support
		await this.runClipAudioLoop(
			clip,
			clipState,
			thisGeneration,
			clipStartSec,
			clipTrimStartSec,
			clipTrimEndSec,
			clipDurationSec,
			cycleOffsetSec,
			loopUntilSec,
			timeIntoClip, // Pass offset for mid-playback scheduling
		);
	}

	/**
	 * Run the audio iterator loop with loop continuation
	 * Handles MediaBunny buffer iteration and recursive looping
	 *
	 * @param timeIntoClipSec - Offset into trimmed region for first cycle (0 for subsequent cycles)
	 */
	private async runClipAudioLoop(
		clip: Clip,
		clipState: ClipScheduleState,
		generation: number,
		clipStartSec: number,
		clipTrimStartSec: number,
		clipTrimEndSec: number,
		clipDurationSec: number,
		cycleOffsetSec: number,
		loopUntilSec: number,
		timeIntoClipSec: number,
	): Promise<void> {
		// Calculate audio file read position for this cycle
		// First invocation uses timeIntoClipSec to skip to current position
		// Subsequent loop cycles pass 0 to start from trim start
		const audioFileReadStart = clipTrimStartSec + timeIntoClipSec;

		// Get buffer iterator from audio engine
		const iterator = await this.audioEngine.getBufferIterator(
			clip.opfsFileId,
			audioFileReadStart,
			clipTrimEndSec,
		);

		// MediaBunny-inspired playback loop
		for await (const { buffer, timestamp } of iterator) {
			// Check generation token - abort if clip was rescheduled
			if (generation !== clipState.generation) {
				break;
			}

			if (this.state !== "playing") break;

			const node = this.audioContext.createBufferSource();
			node.buffer = buffer;

			// Connect to clip gain node
			node.connect(clipState.clipGainNode);

			// Calculate precise start time including cycle offset
			const timeInTrimmed = timestamp - clipTrimStartSec;
			const timelinePos = clipStartSec + cycleOffsetSec + timeInTrimmed;

			// Stop if we've reached or passed the loop boundary
			if (timelinePos >= loopUntilSec) break;

			// Calculate buffer's absolute timeline position in ms
			const bufferTimelineMs =
				clip.startTime + (cycleOffsetSec + timeInTrimmed) * 1000;
			// Convert to AudioContext time using the original play reference
			const startTime =
				this.contextStartTime + (bufferTimelineMs - this.playbackStartTime) / 1000;

			if (startTime >= this.audioContext.currentTime) {
				node.start(startTime);
			} else {
				// Start immediately with offset
				const offset = this.audioContext.currentTime - startTime;
				if (offset < buffer.duration) {
					node.start(this.audioContext.currentTime, offset);
				} else {
					// Buffer already passed, skip it
					continue;
				}
			}

			this.activeNodes.add(node);
			clipState.audioSources.push(node);
			node.onended = () => {
				node.onended = null; // Break circular reference
				this.activeNodes.delete(node);
				const idx = clipState.audioSources.indexOf(node);
				if (idx >= 0) {
					clipState.audioSources.splice(idx, 1);
				}
				try {
					node.disconnect();
				} catch {
					// Already disconnected
				}
			};
		}

		// Handle loop continuation
		if (
			this.state === "playing" &&
			clip.loop &&
			generation === clipState.generation
		) {
			const nextCycleStart = clipStartSec + cycleOffsetSec + clipDurationSec;
			if (nextCycleStart < loopUntilSec) {
				// Continue to next loop cycle
				await this.runClipAudioLoop(
					clip,
					clipState,
					generation,
					clipStartSec,
					clipTrimStartSec,
					clipTrimEndSec,
					clipDurationSec,
					cycleOffsetSec + clipDurationSec, // Increment cycle offset
					loopUntilSec,
					0, // Subsequent cycles always start from trim start
				);
			}
		}
	}

	stop(): void {
		this.state = "stopped";

		// Stop time update loop
		this.stopTimeUpdateLoop();

		// Clear activeNodes tracking (actual cleanup happens via clipStates)
		this.activeNodes.clear();

		// Clean up clip states (authoritative source for audio nodes)
		for (const [, clipState] of this.clipStates) {
			for (const source of clipState.audioSources) {
				try {
					source.onended = null;
					source.stop();
					source.disconnect();
				} catch {
					// Ignore errors
				}
			}
			clipState.audioSources = [];
			clipState.clipGainNode.disconnect();
		}
		this.clipStates.clear();

		this.dispatchEvent(
			new CustomEvent<TransportEvent>("transport", {
				detail: {
					type: "stop",
					state: "stopped",
					currentTime: this.getCurrentTime(),
					timestamp: this.getCurrentTime(),
				},
			}),
		);
	}

	pause(): void {
		if (this.state !== "playing") return;

		// Store current time for resume
		this.pausedTime = this.getCurrentTime();

		// Store tracks snapshot for resume
		this.pausedTracks = Array.from(this.currentTracks.values());

		this.state = "paused";

		// Stop time update loop
		this.stopTimeUpdateLoop();

		// Clear activeNodes tracking (actual cleanup happens via clipStates)
		this.activeNodes.clear();

		// Clean up clip states but keep track states for resume
		for (const [, clipState] of this.clipStates) {
			for (const source of clipState.audioSources) {
				try {
					source.onended = null;
					source.stop();
					source.disconnect();
				} catch {
					// Ignore errors
				}
			}
			clipState.audioSources = [];
		}

		this.dispatchEvent(
			new CustomEvent<TransportEvent>("transport", {
				detail: {
					type: "pause",
					state: "paused",
					currentTime: this.pausedTime,
					timestamp: this.pausedTime,
				},
			}),
		);
	}

	/**
	 * Resume playback from paused position
	 */
	async resume(): Promise<void> {
		if (this.state !== "paused") return;

		// Resume from paused time with stored tracks
		// play() already dispatches "play" event via playClips(), no need to dispatch again
		if (this.pausedTracks.length > 0) {
			await this.play(this.pausedTracks, this.pausedTime);
		}
	}

	seek(timeMs: number): void {
		const wasPlaying = this.state === "playing";
		this.stop();
		this.playbackStartTime = timeMs;

		this.dispatchEvent(
			new CustomEvent<TransportEvent>("transport", {
				detail: {
					type: "seek",
					state: this.state,
					currentTime: timeMs,
					timestamp: timeMs,
					position: timeMs,
				},
			}),
		);

		// Resume playback if we were playing
		if (wasPlaying) {
			// Note: Would need clips to resume - handled by React layer
		}
	}

	getCurrentTime(): number {
		if (this.state !== "playing") return this.playbackStartTime;

		const elapsed = this.audioContext.currentTime - this.contextStartTime;
		return this.playbackStartTime + elapsed * 1000;
	}

	getState(): TransportState {
		return this.state;
	}

	/**
	 * Initialize tracks with gain chain setup
	 * Must be called before play() when using track-based playback
	 */
	async initializeWithTracks(tracks: Track[]): Promise<void> {
		this.trackStates.clear();
		for (const track of tracks) {
			const envelopeGainNode = this.audioContext.createGain();
			const muteSoloGainNode = this.audioContext.createGain();

			// Connect envelope → muteSolo → master
			envelopeGainNode.connect(muteSoloGainNode);
			if (this.masterGainNode) {
				muteSoloGainNode.connect(this.masterGainNode);
			}

			this.trackStates.set(track.id, {
				envelopeGainNode,
				muteSoloGainNode,
				clipStates: new Map(),
				automationGeneration: 0,
				isPlaying: false,
			});
		}

		// Apply initial snapshot for volume/mute/solo state
		this.applySnapshot(tracks);
	}

	/**
	 * Update track volume (in dB)
	 */
	updateTrackVolume(trackId: string, volumeDb: number): void {
		const trackState = this.trackStates.get(trackId);
		if (trackState) {
			// Convert dB to linear gain: gain = 10^(dB/20)
			const linearGain = 10 ** (volumeDb / 20);
			trackState.envelopeGainNode.gain.value = linearGain;
		}
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
		const trackState = this.trackStates.get(trackId);
		if (trackState) {
			const effectiveMuted = muted || (soloEngaged && !isSoloed);
			trackState.muteSoloGainNode.gain.value = effectiveMuted ? 0 : 1;
		}
	}

	/**
	 * Helper to describe envelope for change detection
	 */
	private describeEnvelope(env?: TrackEnvelope): string {
		if (!env || !env.points?.length) return "";
		const pts = env.points.map((p) => `${p.time}:${p.value}`).join(",");
		const segs = (env.segments ?? [])
			.map((s) => `${s.fromPointId}->${s.toPointId}:${s.curve ?? "0"}`)
			.join(",");
		return `${pts}#${segs}`;
	}

	/**
	 * Cancel gain automation safely
	 */
	private cancelGainAutomation(gain: AudioParam, atTime: number): void {
		gain.cancelScheduledValues(atTime);
		gain.setValueAtTime(gain.value, atTime);
	}

	/**
	 * Get current playback time in seconds (internal helper)
	 */
	private getPlaybackTimeSec(): number {
		if (this.state !== "playing") return this.playbackStartTime / 1000;
		const elapsed = this.audioContext.currentTime - this.contextStartTime;
		return this.playbackStartTime / 1000 + elapsed;
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
		const state = this.trackStates.get(track.id);
		if (!state?.envelopeGainNode) return;

		// Check generation token to drop late schedules
		if (generation !== undefined && generation !== state.automationGeneration) {
			return;
		}

		const envelope = track.volumeEnvelope;
		const envelopeGain = state.envelopeGainNode;
		const now = this.audioContext.currentTime;

		// Cancel from now - MAX_CURVE_DURATION to ensure all active curves are canceled
		const cancelFrom = Math.max(0, now - MAX_AUTOMATION_CURVE_DURATION_SEC);
		envelopeGain.gain.cancelScheduledValues(cancelFrom);

		// Reset automation tracking to now after cancellation
		state.lastAutomationEndTime = now;

		// Anchor to instantaneous effective gain at current transport time
		const currentTimeMs = this.getPlaybackTimeSec() * 1000;
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

		// Schedule only future segments relative to transport
		const futurePoints = sorted.filter((point) => point.time > currentTimeMs);
		if (futurePoints.length === 0) {
			const targetGain = baseVolume * currentMultiplier;
			if (Math.abs(envelopeGain.gain.value - targetGain) > 0.00001) {
				envelopeGain.gain.setValueAtTime(targetGain, now);
			}
			return;
		}

		const initialGain = baseVolume * currentMultiplier;
		if (Math.abs(envelopeGain.gain.value - initialGain) > 0.00001) {
			envelopeGain.gain.setValueAtTime(initialGain, now);
		}

		let lastMultiplier = currentMultiplier;
		let lastTime = currentTimeMs;

		const schedulingEpsilon = AUTOMATION_SCHEDULING_EPSILON_SEC;
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
				const mult = lastMultiplier + (point.value - lastMultiplier) * curvedT;
				values[i] = baseVolume * mult;
			}

			const acStart = now + (segmentStart - currentTimeMs) / 1000;
			// Single Math.max guarantees no overlap regardless of floating-point edge cases
			const adjustedStart = Math.max(
				acStart,
				lastScheduledEnd + schedulingEpsilon,
				now + schedulingEpsilon,
			);
			// Keep original duration (don't try to preserve end time - causes overlap)
			const adjustedDuration = Math.max(durationSec, schedulingEpsilon);
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
			// Enforce monotonic forward progress (prevents floating-point boundary overlap)
			const newEnd = adjustedStart + safeDuration;
			lastScheduledEnd = Math.max(lastScheduledEnd + schedulingEpsilon, newEnd);

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
		const state = this.trackStates.get(trackId);
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
	 * Apply track snapshot - mute/solo/volume state
	 */
	private applySnapshot(tracks: Track[]): void {
		if (!this.masterGainNode) return;
		const soloEngaged = tracks.some((track) => track.soloed);

		for (const track of tracks) {
			let state = this.trackStates.get(track.id);

			// Auto-initialize new tracks
			if (!state) {
				state = {
					clipStates: new Map(),
					envelopeGainNode: this.audioContext.createGain(),
					muteSoloGainNode: this.audioContext.createGain(),
					automationGeneration: 0,
					isPlaying: false,
				};
				state.envelopeGainNode.connect(state.muteSoloGainNode);
				state.muteSoloGainNode.connect(this.masterGainNode);
				this.trackStates.set(track.id, state);
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
		this.currentTracks = new Map(tracks.map((t) => [t.id, t]));
	}

	/**
	 * Describe clip for change detection (position, timing, loop state)
	 */
	private describeClip(clip: Clip): string {
		return [
			clip.startTime,
			clip.trimStart,
			clip.sourceDurationMs,
			clip.loop ? 1 : 0,
			clip.loopEnd ?? "",
			clip.fadeIn ?? 0,
			clip.fadeOut ?? 0,
			clip.opfsFileId,
		].join("|");
	}

	/**
	 * Queue a sync operation with mutex to prevent concurrent modifications
	 */
	private async queueSync(fn: () => Promise<void>): Promise<void> {
		const prev = this.syncLock;
		let release: (() => void) | undefined;
		this.syncLock = new Promise((r) => {
			release = r;
		});
		await prev;
		try {
			await fn();
		} finally {
			if (release) {
				release();
			}
		}
	}

	/**
	 * Stop clip via global registry
	 */
	private async stopClipGlobal(clipId: string): Promise<void> {
		const clipState = this.clipStates.get(clipId);
		if (!clipState) return;

		// Stop all sources
		for (const source of clipState.audioSources) {
			try {
				source.onended = null;
				source.stop();
				source.disconnect();
			} catch {
				// Ignore already-stopped nodes
			}
		}
		clipState.audioSources = [];

		// Increment generation to invalidate any late scheduling
		clipState.generation++;

		// Cancel automation on clip gain
		const now = this.audioContext.currentTime;
		this.cancelGainAutomation(clipState.clipGainNode.gain, now);

		// Remove from global registry
		this.activeClips.delete(clipId);
	}

	/**
	 * Start clip via global registry
	 */
	private async startClipGlobal(
		clip: Clip,
		track: Track,
		trackState: TrackState,
	): Promise<void> {
		if (!clip.opfsFileId) return;

		const desc = this.describeClip(clip);
		const currentTime = this.getCurrentTime();

		// Ensure clip-to-track mapping
		this.clipToTrackMap.set(clip.id, track.id);

		// Register in global registry before scheduling
		let clipState = this.clipStates.get(clip.id);
		if (!clipState) {
			clipState = {
				generation: 0,
				clipGainNode: this.audioContext.createGain(),
				audioSources: [],
			};
			clipState.clipGainNode.connect(trackState.envelopeGainNode);
			this.clipStates.set(clip.id, clipState);
		}

		// Increment generation for this scheduling
		clipState.generation++;
		const generation = clipState.generation;

		// Register in active clips
		this.activeClips.set(clip.id, {
			trackId: track.id,
			desc,
			generation,
		});

		// Schedule the clip
		await this.scheduleClip(clip, currentTime);
	}

	/**
	 * Synchronize clips using global registry
	 * Sequential: await all stops, then fire all starts
	 */
	private async synchronizeClipsGlobal(tracks: Track[]): Promise<void> {
		// Build desired state from REAL clips only
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
		const startsNeeded: Array<{ clip: Clip; track: Track }> = [];
		for (const [clipId, { clip, trackId, desc }] of desiredState) {
			const active = this.activeClips.get(clipId);
			if (!active || active.trackId !== trackId || active.desc !== desc) {
				const track = tracks.find((t) => t.id === trackId);
				if (track) {
					startsNeeded.push({ clip, track });
				}
			}
		}

		// Fire all starts (can be parallel after stops complete)
		await Promise.all(
			startsNeeded.map(({ clip, track }) => {
				const trackState = this.trackStates.get(track.id);
				if (trackState) {
					return this.startClipGlobal(clip, track, trackState);
				}
				return Promise.resolve();
			}),
		);
	}

	/**
	 * Synchronize tracks with playback engine
	 * Call this when tracks change during playback
	 */
	async synchronizeTracks(tracks: Track[]): Promise<void> {
		if (this.state === "playing") {
			// Atomic: snapshot + clip sync under mutex to avoid gaps
			await this.queueSync(async () => {
				this.applySnapshot(tracks);
				await this.synchronizeClipsGlobal(tracks);
			}).catch((err) => {
				console.error("Failed to synchronize tracks during playback:", err);
			});
			return;
		}

		// Apply snapshot for stopped/paused state
		this.applySnapshot(tracks);

		// If paused, also update pausedTracks so resume() uses latest state
		if (this.state === "paused") {
			this.pausedTracks = tracks;
		}
	}

	/**
	 * Update solo states for all tracks
	 */
	updateSoloStates(tracks: Track[]): void {
		this.applySnapshot(tracks);
	}

	/**
	 * Set master volume (linear gain, 0-1)
	 */
	setMasterVolume(linearGain: number): void {
		if (this.masterGainNode) {
			this.masterGainNode.gain.value = linearGain;
		}
	}

	/**
	 * Get master meter level in dB
	 */
	getMasterDb(): number {
		if (!this.masterAnalyser) {
			return Number.NEGATIVE_INFINITY;
		}

		const bufferLength = this.masterAnalyser.frequencyBinCount;
		const dataArray = new Float32Array(bufferLength);
		this.masterAnalyser.getFloatTimeDomainData(dataArray);

		// Calculate RMS
		let sum = 0;
		for (let i = 0; i < bufferLength; i++) {
			sum += dataArray[i] * dataArray[i];
		}
		const rms = Math.sqrt(sum / bufferLength);

		// Convert to dB: dB = 20 * log10(rms)
		// Clamp to avoid -Infinity for silence
		if (rms < 1e-10) {
			return Number.NEGATIVE_INFINITY;
		}
		return 20 * Math.log10(rms);
	}

	/**
	 * Start RAF-based time update loop
	 */
	private startTimeUpdateLoop(): void {
		this.stopTimeUpdateLoop(); // Ensure no existing loop

		const update = () => {
			if (this.state === "playing") {
				this.dispatchEvent(
					new CustomEvent("time-update", {
						detail: { currentTime: this.getCurrentTime() },
					}),
				);
				this.timeUpdateLoop = requestAnimationFrame(update);
			}
		};

		update();
	}

	/**
	 * Stop RAF-based time update loop
	 */
	private stopTimeUpdateLoop(): void {
		if (this.timeUpdateLoop !== null) {
			cancelAnimationFrame(this.timeUpdateLoop);
			this.timeUpdateLoop = null;
		}
	}
}
