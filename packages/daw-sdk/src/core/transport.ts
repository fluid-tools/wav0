/**
 * Transport - MediaBunny-inspired playback engine
 *
 * Architecture:
 * - Iterator-based scheduling for precise timing
 * - Event-driven state management
 * - Supports clips with gain, fades, and offsets
 * - Dual gain chain: clip gain → (future: envelope/mute/solo) → destination
 * - Generation tokens prevent late audio scheduling
 */

import type { AudioEngine } from "./audio-engine";
import type { TransportState, TransportEvent } from "../types/core";
import type { Clip } from "../types/schemas";
import {
	AUTOMATION_CANCEL_LOOKAHEAD_SEC,
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

export class Transport extends EventTarget {
	private state: TransportState = "stopped";
	private playbackStartTime = 0;
	private contextStartTime = 0;
	private activeNodes = new Set<AudioBufferSourceNode>();
	/** Track clip schedule states by clip ID */
	private clipStates = new Map<string, ClipScheduleState>();

	constructor(
		private audioEngine: AudioEngine,
		private audioContext: AudioContext,
	) {
		super();
	}

	async play(clips: Clip[], fromTime: number = 0): Promise<void> {
		if (this.state === "playing") return;

		this.stop(); // Clear any existing playback
		this.state = "playing";
		this.playbackStartTime = fromTime;
		this.contextStartTime = this.audioContext.currentTime;

		// Schedule all clips
		for (const clip of clips) {
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
			// Connect clip gain to destination (future: connect to track envelope/mute/solo chain)
			clipState.clipGainNode.connect(this.audioContext.destination);
			this.clipStates.set(clip.id, clipState);
		}

		// Stop any existing audio sources for this clip
		for (const source of clipState.audioSources) {
			try {
				source.stop();
				source.disconnect();
			} catch (e) {
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
			timeIntoClip = Math.max(0, timelineSec - clipStartSec);
		}

		// Apply start grace period
		if (timeIntoClip > 0 && timeIntoClip < START_GRACE_SEC) {
			timeIntoClip = 0;
		}

		// Calculate audio file read position
		const audioFileReadStart = clipTrimStartSec + timeIntoClip;
		if (audioFileReadStart >= clipTrimEndSec) return;

		// Calculate clip start time in AudioContext time
		const clipStartInPlayback = clip.startTime - playbackStart;
		const clipStartAC = this.contextStartTime + clipStartInPlayback / 1000;
		const loopEndAC = this.contextStartTime + (loopUntilSec * 1000 - playbackStart) / 1000;
		const oneShotEndAC = this.contextStartTime + (clipOneShotEndSec * 1000 - playbackStart) / 1000;

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

		// Get buffer iterator from audio engine
		const iterator = await this.audioEngine.getBufferIterator(
			clip.opfsFileId,
			audioFileReadStart,
			clipTrimEndSec,
		);

		// MediaBunny-inspired playback loop
		for await (const { buffer, timestamp } of iterator) {
			// Check generation token - abort if clip was rescheduled
			if (thisGeneration !== clipState.generation) {
				break;
			}

			if (this.state !== "playing") break;

			const node = this.audioContext.createBufferSource();
			node.buffer = buffer;

			// Connect to clip gain node
			node.connect(clipState.clipGainNode);

			// Calculate precise start time
			const bufferStartInClip = timestamp * 1000 - clip.trimStart;
			const startTime =
				this.contextStartTime +
				(clipStartInPlayback + bufferStartInClip) / 1000;

			if (startTime >= this.audioContext.currentTime) {
				node.start(startTime);
			} else {
				// Start immediately with offset
				const offset = this.audioContext.currentTime - startTime;
				node.start(this.audioContext.currentTime, offset);
			}

			this.activeNodes.add(node);
			clipState.audioSources.push(node);
			node.onended = () => {
				this.activeNodes.delete(node);
				const idx = clipState.audioSources.indexOf(node);
				if (idx >= 0) {
					clipState.audioSources.splice(idx, 1);
				}
			};
		}
	}

	stop(): void {
		this.state = "stopped";

		// Stop all active nodes
		for (const node of this.activeNodes) {
			try {
				node.stop();
			} catch (e) {
				// Ignore errors from already-stopped nodes
			}
		}
		this.activeNodes.clear();

		// Clean up clip states
		for (const [, clipState] of this.clipStates) {
			for (const source of clipState.audioSources) {
				try {
					source.stop();
					source.disconnect();
				} catch (e) {
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
		this.state = "paused";
		this.stop(); // For now, pause is same as stop

		this.dispatchEvent(
			new CustomEvent<TransportEvent>("transport", {
				detail: {
					type: "pause",
					state: "paused",
					currentTime: this.getCurrentTime(),
					timestamp: this.getCurrentTime(),
				},
			}),
		);
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
}
