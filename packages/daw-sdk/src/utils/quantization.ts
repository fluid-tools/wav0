/**
 * MIDI Quantization Utilities
 *
 * Provides grid-based quantization for MIDI notes with:
 * - Standard grids (1/4, 1/8, 1/16, etc.)
 * - Triplet grids (1/4T, 1/8T, etc.)
 * - Dotted grids (1/4D, 1/8D, etc.)
 * - Strength-based partial quantization
 * - Swing application
 */

import type { MIDINoteData, MIDITimebase, QuantizeGrid } from "../types/midi";

// ============================================================================
// Grid Definitions
// ============================================================================

/**
 * Grid sizes in ticks at 960 PPQ
 * Scale by (timebase / 960) for other timebases
 */
const GRID_TICKS_960: Record<QuantizeGrid, number> = {
	// Standard divisions (4 beats = whole note = 3840 ticks at 960 PPQ)
	"1/1": 3840, // Whole note
	"1/2": 1920, // Half note
	"1/4": 960, // Quarter note
	"1/8": 480, // Eighth note
	"1/16": 240, // Sixteenth note
	"1/32": 120, // Thirty-second note
	"1/64": 60, // Sixty-fourth note

	// Triplets (2/3 of standard)
	"1/4T": 640, // Quarter triplet (960 * 2/3)
	"1/8T": 320, // Eighth triplet (480 * 2/3)
	"1/16T": 160, // Sixteenth triplet (240 * 2/3)
	"1/32T": 80, // Thirty-second triplet (120 * 2/3)

	// Dotted (1.5x standard)
	"1/4D": 1440, // Dotted quarter (960 * 1.5)
	"1/8D": 720, // Dotted eighth (480 * 1.5)
	"1/16D": 360, // Dotted sixteenth (240 * 1.5)
};

// ============================================================================
// Quantization Namespace
// ============================================================================

export const quantization = {
	/**
	 * Get grid size in ticks for given timebase
	 * @param grid - Quantize grid value
	 * @param timebase - PPQ (default: 960)
	 * @returns Grid size in ticks
	 */
	getGridTicks(grid: QuantizeGrid, timebase: MIDITimebase = 960): number {
		const baseTicks = GRID_TICKS_960[grid];
		return Math.round(baseTicks * (timebase / 960));
	},

	/**
	 * Quantize tick to nearest grid position (round)
	 * @param tick - Original tick position
	 * @param grid - Quantize grid
	 * @param timebase - PPQ (default: 960)
	 * @returns Quantized tick position
	 */
	quantizeRound(
		tick: number,
		grid: QuantizeGrid,
		timebase: MIDITimebase = 960,
	): number {
		const gridTicks = this.getGridTicks(grid, timebase);
		return Math.round(tick / gridTicks) * gridTicks;
	},

	/**
	 * Quantize tick to previous grid position (floor)
	 * @param tick - Original tick position
	 * @param grid - Quantize grid
	 * @param timebase - PPQ (default: 960)
	 * @returns Quantized tick position
	 */
	quantizeFloor(
		tick: number,
		grid: QuantizeGrid,
		timebase: MIDITimebase = 960,
	): number {
		const gridTicks = this.getGridTicks(grid, timebase);
		return Math.floor(tick / gridTicks) * gridTicks;
	},

	/**
	 * Quantize tick to next grid position (ceil)
	 * @param tick - Original tick position
	 * @param grid - Quantize grid
	 * @param timebase - PPQ (default: 960)
	 * @returns Quantized tick position
	 */
	quantizeCeil(
		tick: number,
		grid: QuantizeGrid,
		timebase: MIDITimebase = 960,
	): number {
		const gridTicks = this.getGridTicks(grid, timebase);
		return Math.ceil(tick / gridTicks) * gridTicks;
	},

	/**
	 * Quantize with strength (0-100%)
	 * 0% = no change, 100% = full quantize
	 *
	 * @param tick - Original tick position
	 * @param grid - Quantize grid
	 * @param strength - Quantize strength (0-100)
	 * @param timebase - PPQ (default: 960)
	 * @returns Partially quantized tick position
	 */
	quantizeWithStrength(
		tick: number,
		grid: QuantizeGrid,
		strength: number,
		timebase: MIDITimebase = 960,
	): number {
		const clampedStrength = Math.max(0, Math.min(100, strength));
		const quantized = this.quantizeRound(tick, grid, timebase);
		const delta = quantized - tick;
		return Math.round(tick + delta * (clampedStrength / 100));
	},

	/**
	 * Apply swing to a tick position
	 *
	 * Swing affects every other grid division (typically 8th or 16th notes).
	 * A swing of 50 = straight, 66 = triplet feel, 75 = heavy swing.
	 *
	 * @param tick - Original tick position
	 * @param swingAmount - Swing amount 0-100 (50 = straight, 66 = triplet feel)
	 * @param swingGrid - Which grid level swing affects ('1/8' or '1/16')
	 * @param timebase - PPQ (default: 960)
	 * @returns Tick position with swing applied
	 */
	applySwing(
		tick: number,
		swingAmount: number,
		swingGrid: "1/8" | "1/16",
		timebase: MIDITimebase = 960,
	): number {
		const gridTicks = this.getGridTicks(swingGrid, timebase);
		const halfGrid = gridTicks / 2;

		// Find position within the swing grid
		const gridPosition = tick % gridTicks;

		// Only swing the off-beat (second half of grid)
		// Check if we're near the half-grid position (within a small tolerance)
		const tolerance = halfGrid * 0.1;
		if (
			gridPosition >= halfGrid - tolerance &&
			gridPosition <= halfGrid + tolerance
		) {
			// Calculate swing offset
			// 50% = no swing (center), 66% = triplet feel, 75% = heavy swing
			// Formula: offset = halfGrid * (swingRatio - 0.5) * 2
			const swingRatio = swingAmount / 100;
			const swingOffset = halfGrid * (swingRatio - 0.5) * 2;
			return tick + Math.round(swingOffset);
		}

		return tick;
	},

	/**
	 * Batch quantize array of notes (start positions)
	 * @param notes - Array of MIDI notes
	 * @param grid - Quantize grid
	 * @param strength - Quantize strength (0-100, default: 100)
	 * @param timebase - PPQ (default: 960)
	 * @returns New array with quantized notes
	 */
	quantizeNotes(
		notes: MIDINoteData[],
		grid: QuantizeGrid,
		strength: number = 100,
		timebase: MIDITimebase = 960,
	): MIDINoteData[] {
		return notes.map((note) => ({
			...note,
			tick: this.quantizeWithStrength(note.tick, grid, strength, timebase),
		}));
	},

	/**
	 * Batch quantize note end positions (adjusts duration)
	 * @param notes - Array of MIDI notes
	 * @param grid - Quantize grid
	 * @param strength - Quantize strength (0-100, default: 100)
	 * @param timebase - PPQ (default: 960)
	 * @returns New array with quantized note durations
	 */
	quantizeNoteLengths(
		notes: MIDINoteData[],
		grid: QuantizeGrid,
		strength: number = 100,
		timebase: MIDITimebase = 960,
	): MIDINoteData[] {
		return notes.map((note) => {
			const endTick = note.tick + note.duration;
			const quantizedEnd = this.quantizeWithStrength(
				endTick,
				grid,
				strength,
				timebase,
			);
			// Ensure minimum duration of 1 tick
			const newDuration = Math.max(1, quantizedEnd - note.tick);
			return { ...note, duration: newDuration };
		});
	},

	/**
	 * Quantize both note starts and lengths
	 * @param notes - Array of MIDI notes
	 * @param grid - Quantize grid
	 * @param strength - Quantize strength (0-100, default: 100)
	 * @param timebase - PPQ (default: 960)
	 * @returns New array with fully quantized notes
	 */
	quantizeNotesFull(
		notes: MIDINoteData[],
		grid: QuantizeGrid,
		strength: number = 100,
		timebase: MIDITimebase = 960,
	): MIDINoteData[] {
		// First quantize starts, then lengths
		const quantizedStarts = this.quantizeNotes(notes, grid, strength, timebase);
		return this.quantizeNoteLengths(quantizedStarts, grid, strength, timebase);
	},

	/**
	 * Get all available grid values
	 * @returns Array of all QuantizeGrid values
	 */
	getAvailableGrids(): QuantizeGrid[] {
		return Object.keys(GRID_TICKS_960) as QuantizeGrid[];
	},

	/**
	 * Get grid display name for UI
	 * @param grid - Quantize grid value
	 * @returns Human-readable grid name
	 */
	getGridDisplayName(grid: QuantizeGrid): string {
		const displayNames: Record<QuantizeGrid, string> = {
			"1/1": "Whole",
			"1/2": "Half",
			"1/4": "Quarter",
			"1/8": "8th",
			"1/16": "16th",
			"1/32": "32nd",
			"1/64": "64th",
			"1/4T": "Quarter Triplet",
			"1/8T": "8th Triplet",
			"1/16T": "16th Triplet",
			"1/32T": "32nd Triplet",
			"1/4D": "Dotted Quarter",
			"1/8D": "Dotted 8th",
			"1/16D": "Dotted 16th",
		};
		return displayNames[grid];
	},

	/**
	 * Check if a grid is a triplet
	 */
	isTriplet(grid: QuantizeGrid): boolean {
		return grid.endsWith("T");
	},

	/**
	 * Check if a grid is dotted
	 */
	isDotted(grid: QuantizeGrid): boolean {
		return grid.endsWith("D");
	},
};
