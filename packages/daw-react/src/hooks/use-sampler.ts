/**
 * useSampler hook
 *
 * Provides React integration for the SamplerEngine:
 * - Initializes and manages SamplerEngine lifecycle
 * - Syncs pad state to Jotai atoms
 * - Provides methods for triggering pads
 * - Handles audio context and sample loading
 */

import type { ADSREnvelope, SamplerConfig, SamplerPad } from "@wav0/daw-sdk";
import { SamplerEngine } from "@wav0/daw-sdk";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import {
	activePadIdsAtom,
	activeVoicesAtom,
	samplerInitializedAtom,
	samplerPadsAtom,
	selectedPadIdAtom,
} from "../atoms/sampler";

export interface UseSamplerOptions {
	/** Sampler configuration */
	config?: Partial<SamplerConfig>;
	/** Audio context (will create one if not provided) */
	audioContext?: AudioContext;
	/** Auto-initialize on mount */
	autoInit?: boolean;
}

export interface UseSamplerReturn {
	/** Whether the sampler is initialized */
	isInitialized: boolean;
	/** All pads */
	pads: SamplerPad[];
	/** Currently selected pad ID */
	selectedPadId: string | null;
	/** Currently active (pressed) pad IDs */
	activePadIds: Set<string>;
	/** Select a pad */
	selectPad: (padId: string | null) => void;
	/** Set a pad as active (for visual feedback) */
	setPadActive: (padId: string) => void;
	/** Set a pad as inactive (for visual feedback) */
	setPadInactive: (padId: string) => void;
	/** Trigger a pad by ID */
	triggerPad: (padId: string, velocity?: number) => void;
	/** Release a pad by ID */
	releasePad: (padId: string) => void;
	/** Trigger a pad by note number */
	triggerNote: (note: number, velocity?: number) => void;
	/** Release a pad by note number */
	releaseNote: (note: number) => void;
	/** Load a sample into a pad */
	loadSample: (padId: string, audioBuffer: AudioBuffer) => void;
	/** Load a sample from a file - returns error message if failed */
	loadSampleFromFile: (padId: string, file: File) => Promise<string | null>;
	/** Clear a pad's sample */
	clearSample: (padId: string) => void;
	/** Update pad settings */
	updatePad: (padId: string, updates: Partial<SamplerPad>) => void;
	/** Update pad envelope */
	updateEnvelope: (padId: string, envelope: Partial<ADSREnvelope>) => void;
	/** Initialize the sampler (if autoInit is false) */
	initialize: () => Promise<void>;
	/** Stop all voices */
	stopAll: () => void;
	/** Get the sampler engine instance (for advanced use) */
	getEngine: () => SamplerEngine | null;
	/** Get the audio context */
	getAudioContext: () => AudioContext | null;
}

export function useSampler(options: UseSamplerOptions = {}): UseSamplerReturn {
	const { config, audioContext: providedContext, autoInit = true } = options;

	const engineRef = useRef<SamplerEngine | null>(null);
	const audioContextRef = useRef<AudioContext | null>(providedContext ?? null);

	const [isInitialized, setIsInitialized] = useAtom(samplerInitializedAtom);
	const pads = useAtomValue(samplerPadsAtom);
	const [selectedPadId, setSelectedPadId] = useAtom(selectedPadIdAtom);
	const [activePadIds, setActivePadIds] = useAtom(activePadIdsAtom);
	const setVoices = useSetAtom(activeVoicesAtom);
	const setPads = useSetAtom(samplerPadsAtom);

	// Sync pads from engine to atoms
	const syncPads = useCallback(() => {
		if (!engineRef.current) return;
		const allPads = engineRef.current.getAllPads();
		setPads(allPads);
	}, [setPads]);

	// Sync voices from engine to atoms
	const syncVoices = useCallback(() => {
		if (!engineRef.current) return;
		const activeVoices = engineRef.current.getActiveVoices();
		setVoices(activeVoices);
	}, [setVoices]);

	// Initialize the sampler
	const initialize = useCallback(async () => {
		if (engineRef.current) return;

		// Create or use provided audio context
		if (!audioContextRef.current) {
			audioContextRef.current = new AudioContext();
		}

		// Resume context if suspended (may require user gesture)
		if (audioContextRef.current.state === "suspended") {
			try {
				await audioContextRef.current.resume();
			} catch {
				// Context still suspended, will retry on user interaction
				console.warn("AudioContext suspended - waiting for user interaction");
			}
		}

		// Create sampler engine regardless of context state
		// It will work once context is resumed
		const engine = new SamplerEngine(audioContextRef.current, config);

		// Connect to destination
		engine.connect(audioContextRef.current.destination);

		// Subscribe to events
		engine.addEventListener("voice:start", () => syncVoices());
		engine.addEventListener("voice:release", () => syncVoices());
		engine.addEventListener("voice:end", () => syncVoices());
		engine.addEventListener("voice:stolen", () => syncVoices());
		engine.addEventListener("pad:loaded", () => syncPads());
		engine.addEventListener("pad:cleared", () => syncPads());
		engine.addEventListener("pad:updated", () => syncPads());

		engineRef.current = engine;
		syncPads();
		setIsInitialized(true);
	}, [config, syncPads, syncVoices, setIsInitialized]);

	// Auto-initialize
	useEffect(() => {
		if (autoInit && !isInitialized) {
			initialize();
		}

		return () => {
			if (engineRef.current) {
				engineRef.current.dispose();
				engineRef.current = null;
			}
			// Only close context if we created it
			if (audioContextRef.current && !providedContext) {
				audioContextRef.current.close();
				audioContextRef.current = null;
			}
		};
	}, [autoInit, isInitialized, initialize, providedContext]);

	// Trigger pad by ID
	const triggerPad = useCallback((padId: string, velocity = 100) => {
		if (!engineRef.current) return;
		const pad = engineRef.current.getPad(padId);
		if (!pad) return;
		engineRef.current.triggerAttack(pad.triggerNote, velocity);
	}, []);

	// Release pad by ID
	const releasePad = useCallback((padId: string) => {
		if (!engineRef.current) return;
		const pad = engineRef.current.getPad(padId);
		if (!pad) return;
		engineRef.current.triggerRelease(pad.triggerNote);
	}, []);

	// Trigger by note
	const triggerNote = useCallback((note: number, velocity = 100) => {
		if (!engineRef.current) return;
		engineRef.current.triggerAttack(note, velocity);
	}, []);

	// Release by note
	const releaseNote = useCallback((note: number) => {
		if (!engineRef.current) return;
		engineRef.current.triggerRelease(note);
	}, []);

	// Load sample
	const loadSample = useCallback(
		(padId: string, audioBuffer: AudioBuffer) => {
			if (!engineRef.current) return;
			engineRef.current.loadSample(padId, audioBuffer);
			syncPads();
		},
		[syncPads],
	);

	// Load sample from file - returns error message if failed, null on success
	const loadSampleFromFile = useCallback(
		async (padId: string, file: File): Promise<string | null> => {
			if (!engineRef.current || !audioContextRef.current) {
				return "Sampler not initialized";
			}

			try {
				const arrayBuffer = await file.arrayBuffer();
				const audioBuffer =
					await audioContextRef.current.decodeAudioData(arrayBuffer);
				engineRef.current.loadSample(padId, audioBuffer);

				// Update pad name to file name
				const pad = engineRef.current.getPad(padId);
				if (pad) {
					engineRef.current.updatePad(padId, {
						name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
					});
				}

				syncPads();
				return null; // Success
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to load audio file";
				console.error("Failed to load sample:", error);
				return message;
			}
		},
		[syncPads],
	);

	// Clear sample
	const clearSample = useCallback(
		(padId: string) => {
			if (!engineRef.current) return;
			engineRef.current.clearSample(padId);
			syncPads();
		},
		[syncPads],
	);

	// Update pad
	const updatePad = useCallback(
		(padId: string, updates: Partial<SamplerPad>) => {
			if (!engineRef.current) return;
			engineRef.current.updatePad(padId, updates);
			syncPads();
		},
		[syncPads],
	);

	// Update envelope
	const updateEnvelope = useCallback(
		(padId: string, envelope: Partial<ADSREnvelope>) => {
			if (!engineRef.current) return;
			const pad = engineRef.current.getPad(padId);
			if (!pad) return;
			engineRef.current.updatePad(padId, {
				envelope: { ...pad.envelope, ...envelope },
			});
			syncPads();
		},
		[syncPads],
	);

	// Stop all
	const stopAll = useCallback(() => {
		if (!engineRef.current) return;
		engineRef.current.stopAllVoices();
		syncVoices();
	}, [syncVoices]);

	// Select pad
	const selectPad = useCallback(
		(padId: string | null) => {
			setSelectedPadId(padId);
		},
		[setSelectedPadId],
	);

	// Set pad active (for visual feedback)
	const setPadActive = useCallback(
		(padId: string) => {
			setActivePadIds((prev) => {
				const next = new Set(prev);
				next.add(padId);
				return next;
			});
		},
		[setActivePadIds],
	);

	// Set pad inactive (for visual feedback)
	const setPadInactive = useCallback(
		(padId: string) => {
			setActivePadIds((prev) => {
				const next = new Set(prev);
				next.delete(padId);
				return next;
			});
		},
		[setActivePadIds],
	);

	// Get engine
	const getEngine = useCallback(() => engineRef.current, []);

	// Get audio context
	const getAudioContext = useCallback(() => audioContextRef.current, []);

	return {
		isInitialized,
		pads,
		selectedPadId,
		activePadIds,
		selectPad,
		setPadActive,
		setPadInactive,
		triggerPad,
		releasePad,
		triggerNote,
		releaseNote,
		loadSample,
		loadSampleFromFile,
		clearSample,
		updatePad,
		updateEnvelope,
		initialize,
		stopAll,
		getEngine,
		getAudioContext,
	};
}
