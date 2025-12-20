/**
 * Sampler Types for WAV0 DAW SDK
 *
 * Supports:
 * - Configurable pad count (default 16, max 64)
 * - Pitch shift, time stretch, and transpose
 * - ADSR envelopes with curve support
 * - Voice management and polyphony
 * - Various play modes (one-shot, gate, toggle, latch)
 */

// ============================================================================
// Sampler Configuration
// ============================================================================

/** Configuration for the sampler engine */
export interface SamplerConfig {
	/** Maximum simultaneous voices (default: 32, max: 64) */
	maxVoices: number;
	/** Default active voice count (default: 4) */
	defaultVoices: number;
	/** Number of pads (default: 16, max: 64) */
	padCount: number;
	/** Pad layout for UI hints */
	padLayout: PadLayout;
	/** Base MIDI note for first pad (default: 36 = C1) */
	baseNote: number;
}

/** Pad layout configuration */
export type PadLayout =
	| { type: "4x4"; rows: 4; cols: 4 } // 16 pads (MPC)
	| { type: "8x8"; rows: 8; cols: 8 } // 64 pads (Push)
	| { type: "custom"; rows: number; cols: number };

/** Default sampler configuration */
export const DEFAULT_SAMPLER_CONFIG: SamplerConfig = {
	maxVoices: 32,
	defaultVoices: 4,
	padCount: 16,
	padLayout: { type: "4x4", rows: 4, cols: 4 },
	baseNote: 36, // C1
};

// ============================================================================
// Pad Definition
// ============================================================================

/** Sample file metadata */
export interface SampleInfo {
	/** Original file name */
	fileName: string;
	/** Duration in seconds */
	duration: number;
	/** Sample rate in Hz */
	sampleRate: number;
	/** Number of channels (1 = mono, 2 = stereo) */
	channels: number;
}

/** Loop configuration for a pad */
export interface PadLoopConfig {
	/** Loop enabled */
	enabled: boolean;
	/** Loop start position (0-1 normalized) */
	start: number;
	/** Loop end position (0-1 normalized) */
	end: number;
}

/** A single sampler pad */
export interface SamplerPad {
	/** Unique pad identifier */
	id: string;
	/** Pad index (0-based) */
	index: number;
	/** Display name */
	name: string;
	/** Loaded audio buffer (null if empty) */
	audioBuffer: AudioBuffer | null;
	/** Sample file info */
	sampleInfo?: SampleInfo;

	// === Key/Note Mapping ===
	/** Root note this sample is tuned to (default: 60 = C4) */
	rootNote: number;
	/** MIDI note that triggers this pad (derived from baseNote + index) */
	triggerNote: number;
	/** Optional key range for chromatic play [low, high] */
	keyRange?: [number, number];

	// === Pitch Controls ===
	/**
	 * Pitch shift in semitones (-24 to +24)
	 * Changes pitch WITHOUT preserving duration (uses playbackRate)
	 */
	pitchShift: number;
	/** Fine tune in cents (-100 to +100) */
	fineTune: number;

	// === Time Controls ===
	/**
	 * Time stretch ratio (0.25 to 4.0, 1.0 = original)
	 * Changes duration WITHOUT changing pitch (granular - future)
	 * For MVP, this affects playbackRate inversely to pitchShift
	 */
	timeStretch: number;

	// === Transpose (Combined) ===
	/**
	 * Musical transpose in semitones (-24 to +24)
	 * Changes pitch AND adjusts time to preserve musical timing
	 * Like Logic Pro's "Flex Pitch" or Ableton's "Transpose"
	 */
	transpose: number;

	// === Envelope (ADSR) ===
	envelope: ADSREnvelope;

	// === Output ===
	/** Volume (0 to 1, default: 1) */
	volume: number;
	/** Pan (-1 = left, 0 = center, 1 = right) */
	pan: number;
	/** Muted */
	muted: boolean;
	/** Solo */
	soloed: boolean;

	// === Playback Options ===
	/** Play mode */
	playMode: PlayMode;
	/** Reverse playback */
	reverse: boolean;
	/** Loop settings */
	loop: PadLoopConfig;

	// === Voice Management ===
	/** Max voices for this pad (0 = use global setting) */
	maxVoices: number;
	/** Choke group - pads in same group stop each other (e.g., hi-hat) */
	chokeGroup?: string;

	// === Display ===
	/** Pad color (hex) */
	color: string;
}

/** Play modes for sample triggering */
export type PlayMode =
	| "one-shot" // Play full sample, ignore note-off
	| "gate" // Play while held, release on note-off
	| "toggle" // Note-on starts, next note-on stops
	| "latch"; // Note-on starts, plays until end or next trigger

// ============================================================================
// ADSR Envelope
// ============================================================================

/** ADSR envelope configuration */
export interface ADSREnvelope {
	/** Attack time in milliseconds (0 to 10000) */
	attack: number;
	/** Attack curve (-99 to +99, 0 = linear) */
	attackCurve: number;
	/** Decay time in milliseconds (0 to 10000) */
	decay: number;
	/** Decay curve (-99 to +99) */
	decayCurve: number;
	/** Sustain level (0 to 1) */
	sustain: number;
	/** Release time in milliseconds (0 to 10000) */
	release: number;
	/** Release curve (-99 to +99) */
	releaseCurve: number;
}

/** Default ADSR envelope */
export const DEFAULT_ENVELOPE: ADSREnvelope = {
	attack: 0,
	attackCurve: 0,
	decay: 0,
	decayCurve: 0,
	sustain: 1,
	release: 50,
	releaseCurve: -30, // Slight exponential for natural decay
};

// ============================================================================
// Voice State
// ============================================================================

/** State of a voice in the voice pool */
export type VoiceState =
	| "idle" // Available for use
	| "attack" // In attack phase
	| "decay" // In decay phase
	| "sustain" // Holding at sustain level
	| "release" // Fading out
	| "finished"; // Completed, ready for cleanup

/** A single playing voice */
export interface Voice {
	/** Unique voice identifier */
	id: string;
	/** Pad this voice is playing */
	padId: string;
	/** MIDI note that triggered this voice */
	note: number;
	/** Trigger velocity (0-127) */
	velocity: number;
	/** Voice state */
	state: VoiceState;
	/** AudioContext time when voice started */
	startTime: number;
	/** AudioContext time when release started (if releasing) */
	releaseStartTime?: number;

	// === Generation Counter (for detecting voice reuse) ===
	/**
	 * Incremented each time the voice is reused.
	 * Used to guard setTimeout callbacks from affecting reused voices.
	 */
	generation: number;

	// === Envelope Tracking (for accurate release level calculation) ===
	/**
	 * Peak level reached during attack phase (velocity * volume).
	 * Used to calculate envelope value at any point.
	 */
	peakLevel: number;
	/**
	 * Sustain level after decay phase (peakLevel * envelope.sustain).
	 * Used to calculate envelope value at any point.
	 */
	sustainLevel: number;
	/**
	 * Level at which release phase started.
	 * Captured at the moment of release for accurate envelope calculation.
	 */
	releaseLevelStart?: number;

	// === Audio Nodes (managed by SamplerEngine) ===
	/** Audio buffer source node */
	sourceNode: AudioBufferSourceNode | null;
	/** Gain node for envelope/volume */
	gainNode: GainNode | null;
	/** Stereo panner node */
	pannerNode: StereoPannerNode | null;
}

// ============================================================================
// Voice Stealing
// ============================================================================

/** Voice stealing algorithm mode */
export type VoiceStealingMode =
	| "oldest" // Steal oldest voice first (FIFO)
	| "lowest-velocity" // Steal quietest voice first
	| "same-note" // Only steal same note (retrigger)
	| "none"; // Don't steal, reject new notes when full

/** Voice stealing configuration */
export interface VoiceStealingConfig {
	/** Stealing algorithm mode */
	mode: VoiceStealingMode;
	/** Fade out time when stealing (ms) */
	fadeOutMs: number;
	/** Prioritize stealing voices in release state */
	preferReleasing: boolean;
}

/** Default voice stealing configuration */
export const DEFAULT_VOICE_STEALING: VoiceStealingConfig = {
	mode: "oldest",
	fadeOutMs: 5,
	preferReleasing: true,
};

// ============================================================================
// Sampler Events
// ============================================================================

/** Events emitted by the sampler */
export interface SamplerEventMap {
	"voice:start": {
		voiceId: string;
		padId: string;
		note: number;
		velocity: number;
	};
	"voice:release": { voiceId: string; padId: string; note: number };
	"voice:end": { voiceId: string; padId: string; note: number };
	"voice:stolen": { voiceId: string; stolenBy: string };
	"pad:loaded": { padId: string; buffer: AudioBuffer };
	"pad:cleared": { padId: string };
	"pad:updated": { padId: string; changes: Partial<SamplerPad> };
}

// ============================================================================
// Default Pad Factory
// ============================================================================

/** Create a default pad configuration */
export function createDefaultPad(
	index: number,
	baseNote: number = 36,
): SamplerPad {
	return {
		id: `pad-${index}`,
		index,
		name: `Pad ${index + 1}`,
		audioBuffer: null,
		rootNote: 60, // C4
		triggerNote: baseNote + index,
		pitchShift: 0,
		fineTune: 0,
		timeStretch: 1,
		transpose: 0,
		envelope: { ...DEFAULT_ENVELOPE },
		volume: 1,
		pan: 0,
		muted: false,
		soloed: false,
		playMode: "one-shot",
		reverse: false,
		loop: { enabled: false, start: 0, end: 1 },
		maxVoices: 0,
		color: "#3b82f6",
	};
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert semitones to playback rate
 * @param semitones - Number of semitones (positive = higher pitch)
 * @returns Playback rate multiplier
 */
export function semitonesToRate(semitones: number): number {
	return 2 ** (semitones / 12);
}

/**
 * Convert playback rate to semitones
 * @param rate - Playback rate multiplier
 * @returns Number of semitones
 */
export function rateToSemitones(rate: number): number {
	return 12 * Math.log2(rate);
}

/**
 * Calculate combined playback rate from pitch shift and fine tune
 * @param pitchShift - Semitones
 * @param fineTune - Cents (-100 to +100)
 * @returns Combined playback rate
 */
export function calculatePlaybackRate(
	pitchShift: number,
	fineTune: number,
): number {
	return semitonesToRate(pitchShift + fineTune / 100);
}

/**
 * Get pad grid position from index
 * @param index - Pad index (0-based)
 * @param cols - Number of columns in grid
 * @returns [row, col] position (0-based)
 */
export function getPadGridPosition(
	index: number,
	cols: number = 4,
): [number, number] {
	const row = Math.floor(index / cols);
	const col = index % cols;
	return [row, col];
}

/**
 * Get pad index from grid position
 * @param row - Row index (0-based)
 * @param col - Column index (0-based)
 * @param cols - Number of columns in grid
 * @returns Pad index
 */
export function getPadIndexFromGrid(
	row: number,
	col: number,
	cols: number = 4,
): number {
	return row * cols + col;
}
