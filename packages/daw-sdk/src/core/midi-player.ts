/**
 * MIDIPlayer - Timer-based MIDI event scheduler
 *
 * Inspired by signal-midi's EventScheduler pattern:
 * - Lookahead scheduling for sample-accurate timing
 * - Tick-based internal timing with ms conversion
 * - Generation tokens for safe reschedule on seek
 * - Loop support with seamless wrap
 *
 * Architecture:
 * - Uses setInterval for polling (not RAF, to work in background)
 * - Schedules events within lookahead window
 * - Converts tick positions to setTimeout delays
 * - Maintains currentTick via elapsed time calculation
 *
 * Usage:
 * ```typescript
 * const player = new MIDIPlayer({
 *   onNoteOn: (note, velocity, channel) => sampler.triggerAttack(note, velocity),
 *   onNoteOff: (note, channel) => sampler.triggerRelease(note),
 * })
 *
 * player.setTempo(120)
 * player.loadTrack(midiTrack)
 * player.play()
 * ```
 */

import type {
	MIDINoteData,
	MIDIPlayerCallbacks,
	MIDIPlayerConfig,
	MIDIPlayerState,
	MIDITimebase,
	MIDITrack,
} from "../types/midi";
import { midiTime } from "../utils/midi-time";

// ============================================================================
// Internal Types
// ============================================================================

interface ScheduledEvent {
	id: string;
	timeoutId: number;
	type: "noteon" | "noteoff" | "cc" | "pitchbend";
	generation: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<MIDIPlayerConfig> = {
	timebase: 960,
	lookaheadMs: 100,
	timerIntervalMs: 25,
};

// ============================================================================
// MIDIPlayer Class
// ============================================================================

export class MIDIPlayer extends EventTarget {
	private config: Required<MIDIPlayerConfig>;
	private callbacks: MIDIPlayerCallbacks;

	private track: MIDITrack | null = null;
	private playing = false;
	private recording = false;

	private tempo = 120;
	private timeSignature: [number, number] = [4, 4];

	private currentTick = 0;
	private scheduledTick = 0;
	private startTime = 0; // performance.now() at play start
	private startTick = 0; // Tick position at play start

	private generation = 0; // Incremented on seek/stop for safe reschedule
	private intervalId: number | null = null;
	private scheduledEvents: ScheduledEvent[] = [];

	private loop = {
		enabled: false,
		startTick: 0,
		endTick: 0,
	};

	constructor(callbacks: MIDIPlayerCallbacks, config?: MIDIPlayerConfig) {
		super();
		this.callbacks = callbacks;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	// ===========================================================================
	// Track Management
	// ===========================================================================

	/**
	 * Load a MIDI track for playback
	 */
	loadTrack(track: MIDITrack): void {
		this.stop();
		this.track = track;
		this.currentTick = 0;
		this.scheduledTick = 0;
	}

	/**
	 * Unload the current track
	 */
	unloadTrack(): void {
		this.stop();
		this.track = null;
	}

	/**
	 * Get the currently loaded track
	 */
	getTrack(): MIDITrack | null {
		return this.track;
	}

	// ===========================================================================
	// Playback Control
	// ===========================================================================

	/**
	 * Start playback from current position or specified tick
	 */
	play(fromTick?: number): void {
		if (this.playing) return;
		if (!this.track) {
			console.warn("MIDIPlayer: No track loaded");
			return;
		}

		const startPosition = fromTick ?? this.currentTick;

		this.playing = true;
		this.startTick = startPosition;
		this.currentTick = startPosition;
		this.scheduledTick = startPosition;
		this.startTime = performance.now();
		this.generation++;

		// Start the scheduling loop
		this.intervalId = window.setInterval(
			() => this.tick(),
			this.config.timerIntervalMs,
		);

		// Immediately schedule first batch
		this.tick();

		this.dispatchEvent(
			new CustomEvent("play", { detail: { tick: startPosition } }),
		);
	}

	/**
	 * Pause playback (maintains position)
	 */
	pause(): void {
		if (!this.playing) return;

		this.playing = false;
		this.clearScheduledEvents();

		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		// Save current position for resume
		this.startTick = this.currentTick;

		this.dispatchEvent(
			new CustomEvent("pause", { detail: { tick: this.currentTick } }),
		);
	}

	/**
	 * Resume playback from paused position
	 */
	resume(): void {
		if (this.playing || !this.track) return;
		this.play(this.startTick);
	}

	/**
	 * Stop playback and reset to beginning
	 */
	stop(): void {
		this.playing = false;
		this.clearScheduledEvents();

		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		this.currentTick = 0;
		this.scheduledTick = 0;
		this.startTick = 0;
		this.generation++;

		this.dispatchEvent(new CustomEvent("stop"));
	}

	/**
	 * Seek to a specific tick position
	 */
	seek(tick: number): void {
		const wasPlaying = this.playing;

		// Clear current schedule
		this.clearScheduledEvents();
		this.generation++;

		this.currentTick = Math.max(0, tick);
		this.scheduledTick = this.currentTick;
		this.startTick = this.currentTick;
		this.startTime = performance.now();

		if (wasPlaying) {
			// Immediately reschedule from new position
			this.tick();
		}

		this.dispatchEvent(new CustomEvent("seek", { detail: { tick } }));
	}

	/**
	 * Check if currently playing
	 */
	isPlaying(): boolean {
		return this.playing;
	}

	/**
	 * Check if currently recording
	 */
	isRecording(): boolean {
		return this.recording;
	}

	// ===========================================================================
	// Tempo & Time Signature
	// ===========================================================================

	/**
	 * Set tempo in BPM
	 */
	setTempo(bpm: number): void {
		if (bpm <= 0) throw new Error("Tempo must be positive");

		// Recalculate startTime to maintain position during tempo change
		if (this.playing) {
			const currentMs = this.getCurrentMs();
			this.tempo = bpm;
			this.startTime = performance.now() - currentMs;
		} else {
			this.tempo = bpm;
		}

		this.dispatchEvent(new CustomEvent("tempochange", { detail: { bpm } }));
	}

	/**
	 * Get current tempo
	 */
	getTempo(): number {
		return this.tempo;
	}

	/**
	 * Set time signature
	 */
	setTimeSignature(numerator: number, denominator: number): void {
		this.timeSignature = [numerator, denominator];
		this.dispatchEvent(
			new CustomEvent("timesignaturechange", {
				detail: { timeSignature: this.timeSignature },
			}),
		);
	}

	/**
	 * Get current time signature
	 */
	getTimeSignature(): [number, number] {
		return [...this.timeSignature];
	}

	// ===========================================================================
	// Loop Control
	// ===========================================================================

	/**
	 * Enable/disable looping and set loop points
	 */
	setLoop(enabled: boolean, startTick?: number, endTick?: number): void {
		this.loop.enabled = enabled;
		if (startTick !== undefined) this.loop.startTick = startTick;
		if (endTick !== undefined) this.loop.endTick = endTick;

		this.dispatchEvent(
			new CustomEvent("loopchange", { detail: { ...this.loop } }),
		);
	}

	/**
	 * Get loop settings
	 */
	getLoop(): { enabled: boolean; startTick: number; endTick: number } {
		return { ...this.loop };
	}

	// ===========================================================================
	// Position
	// ===========================================================================

	/**
	 * Get current playback position in ticks
	 */
	getCurrentTick(): number {
		if (!this.playing) return this.currentTick;

		const elapsedMs = performance.now() - this.startTime;
		const elapsedTicks = midiTime.msToTick(
			elapsedMs,
			this.tempo,
			this.config.timebase,
		);
		return this.startTick + elapsedTicks;
	}

	/**
	 * Get current playback position in milliseconds
	 */
	getCurrentMs(): number {
		return midiTime.tickToMs(
			this.getCurrentTick(),
			this.tempo,
			this.config.timebase,
		);
	}

	/**
	 * Get current position as Bar:Beat:Tick string
	 */
	getCurrentBBT(): string {
		return midiTime.formatBBT(
			this.getCurrentTick(),
			this.timeSignature,
			this.config.timebase,
		);
	}

	// ===========================================================================
	// Timebase
	// ===========================================================================

	/**
	 * Set timebase (PPQ)
	 */
	setTimebase(timebase: MIDITimebase): void {
		this.config.timebase = timebase;
	}

	/**
	 * Get current timebase
	 */
	getTimebase(): MIDITimebase {
		return this.config.timebase;
	}

	// ===========================================================================
	// State
	// ===========================================================================

	/**
	 * Get full player state
	 */
	getState(): MIDIPlayerState {
		return {
			playing: this.playing,
			recording: this.recording,
			currentTick: this.getCurrentTick(),
			tempo: this.tempo,
			timeSignature: this.timeSignature,
			loop: { ...this.loop },
		};
	}

	// ===========================================================================
	// Internal: Timer Tick
	// ===========================================================================

	private tick(): void {
		if (!this.playing || !this.track) return;

		const now = performance.now();
		const elapsedMs = now - this.startTime;
		const elapsedTicks = midiTime.msToTick(
			elapsedMs,
			this.tempo,
			this.config.timebase,
		);

		this.currentTick = this.startTick + elapsedTicks;

		// Handle loop wrap
		if (this.loop.enabled && this.currentTick >= this.loop.endTick) {
			const loopLength = this.loop.endTick - this.loop.startTick;
			if (loopLength > 0) {
				const overflow = this.currentTick - this.loop.endTick;

				this.currentTick = this.loop.startTick + (overflow % loopLength);
				this.startTick = this.currentTick;
				this.startTime = now;
				this.scheduledTick = this.currentTick;
				this.generation++;
				this.clearScheduledEvents();

				this.callbacks.onLoopWrap?.();
			}
		}

		// Calculate lookahead window in ticks
		const lookaheadTicks = midiTime.msToTick(
			this.config.lookaheadMs,
			this.tempo,
			this.config.timebase,
		);
		let scheduleUntilTick = this.currentTick + lookaheadTicks;

		// Clamp to loop end if looping
		if (this.loop.enabled && scheduleUntilTick > this.loop.endTick) {
			scheduleUntilTick = this.loop.endTick;
		}

		// Schedule events in window [scheduledTick, scheduleUntilTick)
		if (scheduleUntilTick > this.scheduledTick) {
			this.scheduleEvents(this.scheduledTick, scheduleUntilTick, now);
			this.scheduledTick = scheduleUntilTick;
		}

		// Emit position update
		this.callbacks.onPositionChange?.(this.currentTick, elapsedMs);
	}

	// ===========================================================================
	// Internal: Event Scheduling
	// ===========================================================================

	private scheduleEvents(
		fromTick: number,
		toTick: number,
		_baseTime: number,
	): void {
		if (!this.track) return;
		const gen = this.generation;

		// Schedule notes in range
		const notes = this.track.notes.filter(
			(note) => note.tick >= fromTick && note.tick < toTick,
		);

		for (const note of notes) {
			this.scheduleNote(note, gen);
		}

		// Schedule controller events
		const controllers = this.track.controllers.filter(
			(cc) => cc.tick >= fromTick && cc.tick < toTick,
		);

		for (const cc of controllers) {
			const delayMs = midiTime.tickToMs(
				cc.tick - this.currentTick,
				this.tempo,
				this.config.timebase,
			);

			if (delayMs >= 0 && this.callbacks.onControlChange) {
				const timeoutId = window.setTimeout(() => {
					if (this.generation !== gen) return;
					this.callbacks.onControlChange?.(
						cc.controller,
						cc.value,
						cc.channel ?? 0,
					);
				}, delayMs);

				this.scheduledEvents.push({
					id: cc.id,
					timeoutId,
					type: "cc",
					generation: gen,
				});
			}
		}

		// Schedule pitch bend events
		const pitchBends = this.track.pitchBends.filter(
			(pb) => pb.tick >= fromTick && pb.tick < toTick,
		);

		for (const pb of pitchBends) {
			const delayMs = midiTime.tickToMs(
				pb.tick - this.currentTick,
				this.tempo,
				this.config.timebase,
			);

			if (delayMs >= 0 && this.callbacks.onPitchBend) {
				const timeoutId = window.setTimeout(() => {
					if (this.generation !== gen) return;
					this.callbacks.onPitchBend?.(pb.value, pb.channel ?? 0);
				}, delayMs);

				this.scheduledEvents.push({
					id: pb.id,
					timeoutId,
					type: "pitchbend",
					generation: gen,
				});
			}
		}
	}

	private scheduleNote(note: MIDINoteData, gen: number): void {
		const channel = note.channel ?? this.track?.channel ?? 0;
		const noteOnDelay = midiTime.tickToMs(
			note.tick - this.currentTick,
			this.tempo,
			this.config.timebase,
		);
		const noteOffDelay =
			noteOnDelay +
			midiTime.tickToMs(note.duration, this.tempo, this.config.timebase);

		// Schedule note on
		if (noteOnDelay >= 0) {
			const onTimeoutId = window.setTimeout(() => {
				if (this.generation !== gen) return;
				this.callbacks.onNoteOn(note.noteNumber, note.velocity, channel);
			}, noteOnDelay);

			this.scheduledEvents.push({
				id: `${note.id}-on`,
				timeoutId: onTimeoutId,
				type: "noteon",
				generation: gen,
			});
		}

		// Schedule note off
		if (noteOffDelay >= 0) {
			const offTimeoutId = window.setTimeout(() => {
				if (this.generation !== gen) return;
				this.callbacks.onNoteOff(note.noteNumber, channel);
			}, noteOffDelay);

			this.scheduledEvents.push({
				id: `${note.id}-off`,
				timeoutId: offTimeoutId,
				type: "noteoff",
				generation: gen,
			});
		}
	}

	private clearScheduledEvents(): void {
		for (const event of this.scheduledEvents) {
			clearTimeout(event.timeoutId);
		}
		this.scheduledEvents = [];
	}

	// ===========================================================================
	// Cleanup
	// ===========================================================================

	/**
	 * Dispose of the player and clean up resources
	 */
	dispose(): void {
		this.stop();
		this.track = null;
	}
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MIDIPlayer instance
 */
export function createMIDIPlayer(
	callbacks: MIDIPlayerCallbacks,
	config?: MIDIPlayerConfig,
): MIDIPlayer {
	return new MIDIPlayer(callbacks, config);
}
