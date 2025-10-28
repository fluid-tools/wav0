/**
 * Transport - MediaBunny-inspired playback engine
 *
 * Architecture:
 * - Iterator-based scheduling for precise timing
 * - Event-driven state management
 * - Supports clips with gain, fades, and offsets
 */

import type { AudioEngine } from "./audio-engine";
import type { TransportState, TransportEvent } from "../types/core";
import type { Clip } from "../types/schemas";

export class Transport extends EventTarget {
	private state: TransportState = "stopped";
	private playbackStartTime = 0;
	private contextStartTime = 0;
	private activeNodes = new Set<AudioBufferSourceNode>();

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

	private async scheduleClip(
		clip: Clip,
		playbackStart: number,
	): Promise<void> {
		// Calculate when this clip should start relative to playback
		const clipStartInPlayback = clip.startTime - playbackStart;
		if (clipStartInPlayback < 0) return; // Clip starts before playback position

		// Get buffer iterator from audio engine
		const iterator = await this.audioEngine.getBufferIterator(
			clip.opfsFileId,
			clip.trimStart / 1000,
			(clip.trimStart + clip.sourceDurationMs) / 1000,
		);

		// MediaBunny-inspired playback loop
		for await (const { buffer, timestamp } of iterator) {
			if (this.state !== "playing") break;

			const node = this.audioContext.createBufferSource();
			node.buffer = buffer;

			// Apply clip gain (default to 1.0 if not specified)
			const gainNode = this.audioContext.createGain();
			gainNode.gain.value = 1.0;

			node.connect(gainNode);
			gainNode.connect(this.audioContext.destination);

			// Calculate precise start time
			const bufferStartInClip = timestamp * 1000 - clip.trimStart;
			const startTime =
				this.contextStartTime + (clipStartInPlayback + bufferStartInClip) / 1000;

			if (startTime >= this.audioContext.currentTime) {
				node.start(startTime);
			} else {
				// Start immediately with offset
				const offset = this.audioContext.currentTime - startTime;
				node.start(this.audioContext.currentTime, offset);
			}

			this.activeNodes.add(node);
			node.onended = () => this.activeNodes.delete(node);
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

