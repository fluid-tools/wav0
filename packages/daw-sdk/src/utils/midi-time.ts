/**
 * MIDI Time Conversion Utilities
 *
 * Handles conversions between:
 * - Ticks (internal MIDI timing based on PPQ)
 * - Milliseconds (real time)
 * - Beats (musical time)
 * - Bar:Beat:Tick notation (BBT)
 * - MIDI note numbers and note names
 * - Frequencies
 *
 * Note: This complements the existing utils/time.ts which handles
 * ms/beats/bars conversions. This file focuses on tick-based MIDI
 * operations and note name/frequency conversions.
 */

import type { MIDITimebase } from "../types/midi";

// ============================================================================
// Note Name Constants
// ============================================================================

/** Note names in order (C = 0) */
const NOTE_NAMES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B",
] as const;

/** Alternative note names using flats */
const NOTE_NAMES_FLAT = [
	"C",
	"Db",
	"D",
	"Eb",
	"E",
	"F",
	"Gb",
	"G",
	"Ab",
	"A",
	"Bb",
	"B",
] as const;

/** Map of note letter to semitone offset from C */
const NOTE_LETTER_TO_SEMITONE: Record<string, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11,
};

/** A4 reference frequency (Hz) */
const A4_FREQUENCY = 440;

/** A4 MIDI note number */
const A4_NOTE = 69;

// ============================================================================
// MIDI Time Namespace
// ============================================================================

export const midiTime = {
	// ===========================================================================
	// Tick ↔ Milliseconds
	// ===========================================================================

	/**
	 * Convert ticks to milliseconds
	 * @param tick - Position in ticks
	 * @param bpm - Tempo in beats per minute
	 * @param timebase - PPQ (default: 960)
	 * @returns Time in milliseconds
	 */
	tickToMs(tick: number, bpm: number, timebase: MIDITimebase = 960): number {
		// ticks / (ticks per beat) * (ms per beat)
		// ms per beat = 60000 / bpm
		return (tick / timebase) * (60000 / bpm);
	},

	/**
	 * Convert milliseconds to ticks
	 * @param ms - Time in milliseconds
	 * @param bpm - Tempo in beats per minute
	 * @param timebase - PPQ (default: 960)
	 * @returns Position in ticks
	 */
	msToTick(ms: number, bpm: number, timebase: MIDITimebase = 960): number {
		// Inverse of tickToMs
		return (ms / 60000) * bpm * timebase;
	},

	// ===========================================================================
	// Tick ↔ Beats
	// ===========================================================================

	/**
	 * Convert ticks to beats (quarter notes)
	 * @param tick - Position in ticks
	 * @param timebase - PPQ (default: 960)
	 * @returns Number of beats
	 */
	tickToBeats(tick: number, timebase: MIDITimebase = 960): number {
		return tick / timebase;
	},

	/**
	 * Convert beats to ticks
	 * @param beats - Number of beats
	 * @param timebase - PPQ (default: 960)
	 * @returns Position in ticks
	 */
	beatsToTick(beats: number, timebase: MIDITimebase = 960): number {
		return beats * timebase;
	},

	// ===========================================================================
	// Bar:Beat:Tick (BBT) Formatting
	// ===========================================================================

	/**
	 * Format tick position as Bar:Beat:Tick string
	 *
	 * @param tick - Position in ticks
	 * @param timeSignature - [numerator, denominator], e.g., [4, 4]
	 * @param timebase - PPQ (default: 960)
	 * @returns Formatted string like "1:1:000" (1-indexed bars/beats)
	 */
	formatBBT(
		tick: number,
		timeSignature: [number, number] = [4, 4],
		timebase: MIDITimebase = 960,
	): string {
		const [numerator, denominator] = timeSignature;

		// Ticks per beat (adjusted for time signature denominator)
		// For 4/4: ticksPerBeat = timebase * (4/4) = timebase
		// For 6/8: ticksPerBeat = timebase * (4/8) = timebase/2
		const ticksPerBeat = timebase * (4 / denominator);

		// Ticks per bar
		const ticksPerBar = ticksPerBeat * numerator;

		const bar = Math.floor(tick / ticksPerBar) + 1;
		const remainingTicks = tick % ticksPerBar;
		const beat = Math.floor(remainingTicks / ticksPerBeat) + 1;
		const subtick = Math.round(remainingTicks % ticksPerBeat);

		return `${bar}:${beat}:${subtick.toString().padStart(3, "0")}`;
	},

	/**
	 * Parse Bar:Beat:Tick string to ticks
	 *
	 * @param bbt - BBT string like "1:1:000" or "2:3:480"
	 * @param timeSignature - [numerator, denominator], e.g., [4, 4]
	 * @param timebase - PPQ (default: 960)
	 * @returns Position in ticks
	 * @throws Error if format is invalid
	 */
	parseBBT(
		bbt: string,
		timeSignature: [number, number] = [4, 4],
		timebase: MIDITimebase = 960,
	): number {
		const parts = bbt.split(":").map(Number);
		if (parts.length !== 3 || parts.some(Number.isNaN)) {
			throw new Error(`Invalid BBT format: ${bbt}. Expected "bar:beat:tick"`);
		}

		const [bar, beat, subtick] = parts;
		const [numerator, denominator] = timeSignature;

		const ticksPerBeat = timebase * (4 / denominator);
		const ticksPerBar = ticksPerBeat * numerator;

		return (bar - 1) * ticksPerBar + (beat - 1) * ticksPerBeat + subtick;
	},

	/**
	 * Format tick position as compact BBT (without leading zeros)
	 *
	 * @param tick - Position in ticks
	 * @param timeSignature - [numerator, denominator]
	 * @param timebase - PPQ (default: 960)
	 * @returns Formatted string like "1.1.0"
	 */
	formatBBTCompact(
		tick: number,
		timeSignature: [number, number] = [4, 4],
		timebase: MIDITimebase = 960,
	): string {
		const [numerator, denominator] = timeSignature;
		const ticksPerBeat = timebase * (4 / denominator);
		const ticksPerBar = ticksPerBeat * numerator;

		const bar = Math.floor(tick / ticksPerBar) + 1;
		const remainingTicks = tick % ticksPerBar;
		const beat = Math.floor(remainingTicks / ticksPerBeat) + 1;
		const subtick = Math.round(remainingTicks % ticksPerBeat);

		return `${bar}.${beat}.${subtick}`;
	},

	// ===========================================================================
	// Note Number ↔ Note Name
	// ===========================================================================

	/**
	 * Convert MIDI note number to note name
	 *
	 * @param note - MIDI note number (0-127)
	 * @param useFlats - Use flat names instead of sharps (default: false)
	 * @returns Note name like "C4", "F#5", "Bb3"
	 */
	noteNumberToName(note: number, useFlats: boolean = false): string {
		if (note < 0 || note > 127) {
			throw new Error(`Invalid MIDI note number: ${note}. Must be 0-127.`);
		}

		const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
		const octave = Math.floor(note / 12) - 1;
		const noteName = noteNames[note % 12];

		return `${noteName}${octave}`;
	},

	/**
	 * Convert note name to MIDI note number
	 *
	 * @param name - Note name like "C4", "F#5", "Db3", "Bb-1"
	 * @returns MIDI note number (0-127)
	 * @throws Error if name is invalid
	 */
	noteNameToNumber(name: string): number {
		// Match pattern: note letter + optional accidental + octave (including negative)
		const match = name.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
		if (!match) {
			throw new Error(
				`Invalid note name: ${name}. Expected format like "C4", "F#5", "Bb3"`,
			);
		}

		const [, letter, accidental, octaveStr] = match;
		const baseSemitone = NOTE_LETTER_TO_SEMITONE[letter.toUpperCase()];

		if (baseSemitone === undefined) {
			throw new Error(`Invalid note letter: ${letter}`);
		}

		let semitone = baseSemitone;
		if (accidental === "#") semitone += 1;
		if (accidental === "b") semitone -= 1;

		const octave = parseInt(octaveStr, 10);
		const noteNumber = (octave + 1) * 12 + semitone;

		if (noteNumber < 0 || noteNumber > 127) {
			throw new Error(
				`Note ${name} is outside MIDI range (0-127). Got: ${noteNumber}`,
			);
		}

		return noteNumber;
	},

	// ===========================================================================
	// Frequency Conversion
	// ===========================================================================

	/**
	 * Convert MIDI note number to frequency (Hz)
	 * Uses A4 = 440 Hz as reference
	 *
	 * @param note - MIDI note number (0-127)
	 * @returns Frequency in Hz
	 */
	noteNumberToFrequency(note: number): number {
		// f = 440 * 2^((n-69)/12)
		return A4_FREQUENCY * 2 ** ((note - A4_NOTE) / 12);
	},

	/**
	 * Convert frequency to nearest MIDI note number
	 *
	 * @param frequency - Frequency in Hz
	 * @returns Nearest MIDI note number (0-127)
	 */
	frequencyToNoteNumber(frequency: number): number {
		// n = 69 + 12 * log2(f/440)
		const note = Math.round(A4_NOTE + 12 * Math.log2(frequency / A4_FREQUENCY));
		return Math.max(0, Math.min(127, note));
	},

	/**
	 * Get the cents deviation from the nearest MIDI note
	 *
	 * @param frequency - Frequency in Hz
	 * @returns Cents deviation (-50 to +50)
	 */
	frequencyToCents(frequency: number): number {
		const note = A4_NOTE + 12 * Math.log2(frequency / A4_FREQUENCY);
		const nearestNote = Math.round(note);
		return Math.round((note - nearestNote) * 100);
	},

	// ===========================================================================
	// Octave Utilities
	// ===========================================================================

	/**
	 * Get octave number from MIDI note
	 * @param note - MIDI note number (0-127)
	 * @returns Octave number (-1 to 9)
	 */
	getOctave(note: number): number {
		return Math.floor(note / 12) - 1;
	},

	/**
	 * Get note within octave (0-11, where C=0)
	 * @param note - MIDI note number (0-127)
	 * @returns Note index within octave (0-11)
	 */
	getNoteInOctave(note: number): number {
		return note % 12;
	},

	/**
	 * Check if a note is a black key (sharp/flat)
	 * @param note - MIDI note number (0-127)
	 * @returns true if black key
	 */
	isBlackKey(note: number): boolean {
		const noteInOctave = note % 12;
		// Black keys are at positions 1, 3, 6, 8, 10 (C#, D#, F#, G#, A#)
		return [1, 3, 6, 8, 10].includes(noteInOctave);
	},

	/**
	 * Check if a note is a white key (natural)
	 * @param note - MIDI note number (0-127)
	 * @returns true if white key
	 */
	isWhiteKey(note: number): boolean {
		return !this.isBlackKey(note);
	},

	// ===========================================================================
	// Duration Utilities
	// ===========================================================================

	/**
	 * Convert note duration in ticks to milliseconds
	 * @param durationTicks - Duration in ticks
	 * @param bpm - Tempo in BPM
	 * @param timebase - PPQ (default: 960)
	 * @returns Duration in milliseconds
	 */
	durationTicksToMs(
		durationTicks: number,
		bpm: number,
		timebase: MIDITimebase = 960,
	): number {
		return this.tickToMs(durationTicks, bpm, timebase);
	},

	/**
	 * Convert note duration in milliseconds to ticks
	 * @param durationMs - Duration in milliseconds
	 * @param bpm - Tempo in BPM
	 * @param timebase - PPQ (default: 960)
	 * @returns Duration in ticks
	 */
	durationMsToTicks(
		durationMs: number,
		bpm: number,
		timebase: MIDITimebase = 960,
	): number {
		return this.msToTick(durationMs, bpm, timebase);
	},

	/**
	 * Get note duration in ticks for common note values
	 * @param noteValue - Note value like "quarter", "eighth", "sixteenth"
	 * @param timebase - PPQ (default: 960)
	 * @returns Duration in ticks
	 */
	getNoteDurationTicks(
		noteValue:
			| "whole"
			| "half"
			| "quarter"
			| "eighth"
			| "sixteenth"
			| "thirtysecond",
		timebase: MIDITimebase = 960,
	): number {
		const durations: Record<string, number> = {
			whole: timebase * 4,
			half: timebase * 2,
			quarter: timebase,
			eighth: timebase / 2,
			sixteenth: timebase / 4,
			thirtysecond: timebase / 8,
		};
		return durations[noteValue];
	},
};
