/**
 * Sampler atoms for @wav0/daw-react
 *
 * State management for the sampler engine including:
 * - Pad state (loaded samples, selection)
 * - Active voices
 * - ADSR envelope editing
 * - Keyboard mapping
 */

import type { SamplerPad, Voice } from "@wav0/daw-sdk";
import { atom } from "jotai";

// ============================================================================
// Core Sampler State
// ============================================================================

/** Currently selected pad ID */
export const selectedPadIdAtom = atom<string | null>(null);

/** All pads state (synced from SamplerEngine) */
export const samplerPadsAtom = atom<SamplerPad[]>([]);

/** Active voices (synced from SamplerEngine events) */
export const activeVoicesAtom = atom<Voice[]>([]);

/** Whether the sampler is initialized */
export const samplerInitializedAtom = atom(false);

/** Currently active (pressed) pad IDs - for visual feedback on keyboard/MIDI triggers */
export const activePadIdsAtom = atom<Set<string>>(new Set<string>());

// ============================================================================
// Derived Atoms
// ============================================================================

/** Get the currently selected pad */
export const selectedPadAtom = atom((get) => {
	const selectedId = get(selectedPadIdAtom);
	if (!selectedId) return null;
	return get(samplerPadsAtom).find((p) => p.id === selectedId) ?? null;
});

/** Get pads that have samples loaded */
export const loadedPadsAtom = atom((get) => {
	return get(samplerPadsAtom).filter((p) => p.audioBuffer !== null);
});

/** Get voice count for a specific pad */
export const padVoiceCountAtom = atom((get) => {
	const voices = get(activeVoicesAtom);
	return (padId: string) => voices.filter((v) => v.padId === padId).length;
});

/** Check if a specific pad is currently playing */
export const isPadPlayingAtom = atom((get) => {
	const voices = get(activeVoicesAtom);
	return (padId: string) =>
		voices.some(
			(v) => v.padId === padId && v.state !== "idle" && v.state !== "finished",
		);
});

// ============================================================================
// UI State
// ============================================================================

/** Keyboard layout for pad triggering (QWERTY rows) */
export const padKeyboardLayoutAtom = atom<string[]>([
	// Bottom row (pads 0-3)
	"z",
	"x",
	"c",
	"v",
	// Second row (pads 4-7)
	"a",
	"s",
	"d",
	"f",
	// Third row (pads 8-11)
	"q",
	"w",
	"e",
	"r",
	// Top row (pads 12-15)
	"1",
	"2",
	"3",
	"4",
]);

/** Whether to show waveforms in pads */
export const showPadWaveformsAtom = atom(true);

/** Whether to show pad labels */
export const showPadLabelsAtom = atom(true);

/** Pad grid size (4x4, 8x8, etc.) */
export const padGridSizeAtom = atom<{ rows: number; cols: number }>({
	rows: 4,
	cols: 4,
});

// ============================================================================
// ADSR Editing State
// ============================================================================

/** Currently edited envelope parameter */
export type EnvelopeParam = "attack" | "decay" | "sustain" | "release" | null;

export const editingEnvelopeParamAtom = atom<EnvelopeParam>(null);

/** Whether ADSR editor is expanded */
export const adsrEditorExpandedAtom = atom(true);

// ============================================================================
// Write Atoms (Actions)
// ============================================================================

/** Select a pad by ID */
export const selectPadAtom = atom(null, (_get, set, padId: string | null) => {
	set(selectedPadIdAtom, padId);
});

/** Update pads state (called from SamplerEngine sync) */
export const updatePadsAtom = atom(null, (_get, set, pads: SamplerPad[]) => {
	set(samplerPadsAtom, pads);
});

/** Update active voices (called from SamplerEngine events) */
export const updateVoicesAtom = atom(null, (_get, set, voices: Voice[]) => {
	set(activeVoicesAtom, voices);
});

/** Update a single pad */
export const updatePadAtom = atom(
	null,
	(get, set, padId: string, updates: Partial<SamplerPad>) => {
		const pads = get(samplerPadsAtom);
		const updatedPads = pads.map((p) =>
			p.id === padId ? { ...p, ...updates } : p,
		);
		set(samplerPadsAtom, updatedPads);
	},
);

/** Clear selection */
export const clearPadSelectionAtom = atom(null, (_get, set) => {
	set(selectedPadIdAtom, null);
});

/** Set a pad as active (pressed) */
export const setPadActiveAtom = atom(null, (get, set, padId: string) => {
	const current = get(activePadIdsAtom);
	const next = new Set(current);
	next.add(padId);
	set(activePadIdsAtom, next);
});

/** Set a pad as inactive (released) */
export const setPadInactiveAtom = atom(null, (get, set, padId: string) => {
	const current = get(activePadIdsAtom);
	const next = new Set(current);
	next.delete(padId);
	set(activePadIdsAtom, next);
});

/** Clear all active pads */
export const clearActivePadsAtom = atom(null, (_get, set) => {
	set(activePadIdsAtom, new Set());
});
