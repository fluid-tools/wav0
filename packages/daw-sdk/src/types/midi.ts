/**
 * MIDI Types for WAV0 DAW SDK
 *
 * Supports:
 * - Real-time MIDI input events (from hardware)
 * - Stored MIDI data (tracks, regions, notes)
 * - MIDI learn bindings (CC → parameter mapping)
 * - Quantization settings
 */

// ============================================================================
// Timebase Configuration
// ============================================================================

/** Ticks per quarter note (PPQ) */
export type MIDITimebase = 480 | 960;

/** Default timebase - 960 PPQ for higher precision */
export const DEFAULT_TIMEBASE: MIDITimebase = 960;

// ============================================================================
// Device Types
// ============================================================================

/** MIDI device information */
export interface MIDIDeviceInfo {
	/** Unique device identifier */
	id: string;
	/** Human-readable device name */
	name: string;
	/** Device manufacturer */
	manufacturer: string;
	/** Current connection state */
	state: "connected" | "disconnected";
}

// ============================================================================
// Real-time Input Events (from hardware MIDI devices)
// ============================================================================

/** Note-on event from MIDI input */
export interface MIDINoteOnEvent {
	type: "noteon";
	/** MIDI note number (0-127) */
	note: number;
	/** Velocity (1-127, 0 is treated as noteoff) */
	velocity: number;
	/** MIDI channel (0-15) */
	channel: number;
	/** DOMHighResTimeStamp from performance.now() */
	timestamp: number;
}

/** Note-off event from MIDI input */
export interface MIDINoteOffEvent {
	type: "noteoff";
	/** MIDI note number (0-127) */
	note: number;
	/** Release velocity (often 0 or 64) */
	velocity: number;
	/** MIDI channel (0-15) */
	channel: number;
	/** DOMHighResTimeStamp */
	timestamp: number;
}

/** Control change event from MIDI input */
export interface MIDIControlChangeEvent {
	type: "controlchange";
	/** Controller number (0-127) */
	controller: number;
	/** Controller value (0-127) */
	value: number;
	/** MIDI channel (0-15) */
	channel: number;
	/** DOMHighResTimeStamp */
	timestamp: number;
}

/** Pitch bend event from MIDI input */
export interface MIDIPitchBendEvent {
	type: "pitchbend";
	/** Pitch bend value (-8192 to +8191, 0 = center) */
	value: number;
	/** MIDI channel (0-15) */
	channel: number;
	/** DOMHighResTimeStamp */
	timestamp: number;
}

/** Union of all real-time MIDI input events */
export type MIDIInputEvent =
	| MIDINoteOnEvent
	| MIDINoteOffEvent
	| MIDIControlChangeEvent
	| MIDIPitchBendEvent;

// ============================================================================
// Common MIDI Controller Numbers
// ============================================================================

/** Standard MIDI CC numbers */
export const MIDI_CC = {
	/** Bank select MSB */
	BANK_SELECT: 0,
	/** Modulation wheel */
	MOD_WHEEL: 1,
	/** Breath controller */
	BREATH: 2,
	/** Foot controller */
	FOOT: 4,
	/** Portamento time */
	PORTAMENTO_TIME: 5,
	/** Data entry MSB */
	DATA_ENTRY_MSB: 6,
	/** Channel volume */
	VOLUME: 7,
	/** Balance */
	BALANCE: 8,
	/** Pan */
	PAN: 10,
	/** Expression */
	EXPRESSION: 11,
	/** Effect control 1 */
	EFFECT_1: 12,
	/** Effect control 2 */
	EFFECT_2: 13,
	/** Sustain pedal (damper) */
	SUSTAIN: 64,
	/** Portamento on/off */
	PORTAMENTO: 65,
	/** Sostenuto pedal */
	SOSTENUTO: 66,
	/** Soft pedal */
	SOFT_PEDAL: 67,
	/** Legato footswitch */
	LEGATO: 68,
	/** Hold 2 */
	HOLD_2: 69,
	/** All sound off */
	ALL_SOUND_OFF: 120,
	/** Reset all controllers */
	RESET_ALL: 121,
	/** Local control on/off */
	LOCAL_CONTROL: 122,
	/** All notes off */
	ALL_NOTES_OFF: 123,
	/** Omni mode off */
	OMNI_OFF: 124,
	/** Omni mode on */
	OMNI_ON: 125,
	/** Mono mode */
	MONO: 126,
	/** Poly mode */
	POLY: 127,
} as const;

/** Type for CC number constants */
export type MIDICCNumber = (typeof MIDI_CC)[keyof typeof MIDI_CC];

// ============================================================================
// Stored MIDI Data (for tracks/regions/sequencer)
// ============================================================================

/** A MIDI note stored in a track/region */
export interface MIDINoteData {
	/** Unique note identifier */
	id: string;
	/** Start position in ticks */
	tick: number;
	/** Duration in ticks */
	duration: number;
	/** MIDI note number (0-127) */
	noteNumber: number;
	/** Velocity (1-127) */
	velocity: number;
	/** MIDI channel (0-15), defaults to track channel */
	channel?: number;
}

/** A MIDI CC data point stored in a track */
export interface MIDIControllerData {
	/** Unique identifier */
	id: string;
	/** Position in ticks */
	tick: number;
	/** Controller number (0-127) */
	controller: number;
	/** Controller value (0-127) */
	value: number;
	/** MIDI channel (0-15) */
	channel?: number;
}

/** A pitch bend data point stored in a track */
export interface MIDIPitchBendData {
	/** Unique identifier */
	id: string;
	/** Position in ticks */
	tick: number;
	/** Pitch bend value (-8192 to +8191) */
	value: number;
	/** MIDI channel (0-15) */
	channel?: number;
}

/** A tempo change event */
export interface MIDITempoEvent {
	/** Unique identifier */
	id: string;
	/** Position in ticks */
	tick: number;
	/** Tempo in BPM */
	bpm: number;
}

/** A time signature change event */
export interface MIDITimeSignatureEvent {
	/** Unique identifier */
	id: string;
	/** Position in ticks */
	tick: number;
	/** Numerator (e.g., 4 in 4/4) */
	numerator: number;
	/** Denominator as power of 2 (e.g., 4 in 4/4) */
	denominator: number;
}

// ============================================================================
// MIDI Track
// ============================================================================

/** A MIDI track containing notes and controller data */
export interface MIDITrack {
	/** Unique track identifier */
	id: string;
	/** Track name */
	name: string;
	/** Default output channel (0-15) */
	channel: number;
	/** Notes in this track */
	notes: MIDINoteData[];
	/** Controller automation data */
	controllers: MIDIControllerData[];
	/** Pitch bend automation data */
	pitchBends: MIDIPitchBendData[];
	/** Reference to sampler instrument */
	instrumentId?: string;
	/** Track muted */
	muted?: boolean;
	/** Track soloed */
	soloed?: boolean;
	/** Display color (hex) */
	color?: string;
}

// ============================================================================
// MIDI Region (clip on timeline)
// ============================================================================

/** A MIDI region/clip on the arrangement timeline */
export interface MIDIRegion {
	/** Unique region identifier */
	id: string;
	/** Parent audio track on arrangement */
	trackId: string;
	/** Start time on timeline (milliseconds) */
	startTime: number;
	/** Duration (milliseconds) */
	duration: number;
	/** Reference to source MIDITrack data */
	midiTrackId: string;
	/** Loop enabled */
	looped?: boolean;
	/** Loop length in ms (if different from duration) */
	loopLength?: number;
	/** Display color (hex) */
	color?: string;
	/** Region name */
	name?: string;
}

// ============================================================================
// MIDI Learn
// ============================================================================

/** A binding between a MIDI controller and a parameter */
export interface MIDILearnBinding {
	/** Unique binding identifier */
	id: string;
	/** Controller number, 'pitchbend', or 'aftertouch' */
	controller: number | "pitchbend" | "aftertouch";
	/** MIDI channel filter (0-15 or 'all' for omni) */
	channel: number | "all";
	/** Target parameter path (e.g., 'track.{id}.volume') */
	targetPath: string;
	/** Minimum mapped value */
	min: number;
	/** Maximum mapped value */
	max: number;
	/** Curve amount (-99 to +99, 0 = linear) */
	curve?: number;
}

// ============================================================================
// Quantization
// ============================================================================

/** Available quantize grid values */
export type QuantizeGrid =
	// Standard divisions
	| "1/1"
	| "1/2"
	| "1/4"
	| "1/8"
	| "1/16"
	| "1/32"
	| "1/64"
	// Triplets (T suffix)
	| "1/4T"
	| "1/8T"
	| "1/16T"
	| "1/32T"
	// Dotted (D suffix)
	| "1/4D"
	| "1/8D"
	| "1/16D";

/** Quantization settings */
export interface QuantizeSettings {
	/** Grid resolution */
	grid: QuantizeGrid;
	/** Quantize strength (0-100%) */
	strength: number;
	/** Swing amount (0-100, 50 = straight) */
	swing?: number;
	/** Which grid level swing affects */
	swingGrid?: "1/8" | "1/16";
}

// ============================================================================
// MIDI Player State
// ============================================================================

/** Current state of the MIDI player */
export interface MIDIPlayerState {
	/** Is the player currently playing */
	playing: boolean;
	/** Is the player currently recording */
	recording: boolean;
	/** Current position in ticks */
	currentTick: number;
	/** Current tempo in BPM */
	tempo: number;
	/** Current time signature [numerator, denominator] */
	timeSignature: [number, number];
	/** Loop settings */
	loop: {
		enabled: boolean;
		startTick: number;
		endTick: number;
	};
}

// ============================================================================
// MIDI Player Callbacks
// ============================================================================

/** Callbacks for MIDI player events */
export interface MIDIPlayerCallbacks {
	/** Called when a note should start playing */
	onNoteOn: (note: number, velocity: number, channel: number) => void;
	/** Called when a note should stop playing */
	onNoteOff: (note: number, channel: number) => void;
	/** Called for CC events during playback */
	onControlChange?: (
		controller: number,
		value: number,
		channel: number,
	) => void;
	/** Called for pitch bend events during playback */
	onPitchBend?: (value: number, channel: number) => void;
	/** Called on position updates */
	onPositionChange?: (tick: number, ms: number) => void;
	/** Called when loop wraps around */
	onLoopWrap?: () => void;
}

/** Configuration for MIDI player */
export interface MIDIPlayerConfig {
	/** PPQ timebase (default: 960) */
	timebase?: MIDITimebase;
	/** Lookahead time in ms (default: 100) */
	lookaheadMs?: number;
	/** Timer poll interval in ms (default: 25) */
	timerIntervalMs?: number;
}

// ============================================================================
// Utility Functions (type guards)
// ============================================================================

/** Check if event is a note-on event */
export function isNoteOn(event: MIDIInputEvent): event is MIDINoteOnEvent {
	return event.type === "noteon";
}

/** Check if event is a note-off event */
export function isNoteOff(event: MIDIInputEvent): event is MIDINoteOffEvent {
	return event.type === "noteoff";
}

/** Check if event is a control change event */
export function isControlChange(
	event: MIDIInputEvent,
): event is MIDIControlChangeEvent {
	return event.type === "controlchange";
}

/** Check if event is a pitch bend event */
export function isPitchBend(
	event: MIDIInputEvent,
): event is MIDIPitchBendEvent {
	return event.type === "pitchbend";
}
