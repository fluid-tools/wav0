"use client";

import type { ADSREnvelope, SamplerPad } from "@wav0/daw-sdk";
import { SamplerEngine } from "@wav0/daw-sdk";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

// ============================================================================
// Types
// ============================================================================

interface SamplerContextValue {
	// State
	isReady: boolean;
	pads: SamplerPad[];
	selectedPadId: string | null;
	activePadIds: Set<string>;

	// Actions
	selectPad: (padId: string | null) => void;
	triggerPad: (padId: string, velocity?: number) => void;
	releasePad: (padId: string) => void;
	loadSample: (padId: string, file: File) => Promise<string | null>;
	clearSample: (padId: string) => void;
	updatePad: (padId: string, updates: Partial<SamplerPad>) => void;
	updateEnvelope: (padId: string, envelope: Partial<ADSREnvelope>) => void;
	stopAll: () => void;

	// For keyboard/MIDI visual feedback
	setPadActive: (padId: string) => void;
	setPadInactive: (padId: string) => void;
}

const SamplerContext = createContext<SamplerContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function SamplerProvider({ children }: { children: ReactNode }) {
	// Core state
	const [isReady, setIsReady] = useState(false);
	const [pads, setPads] = useState<SamplerPad[]>([]);
	const [selectedPadId, setSelectedPadId] = useState<string | null>(null);
	const [activePadIds, setActivePadIds] = useState<Set<string>>(new Set());

	// Refs for engine and audio context (stable across renders)
	const engineRef = useRef<SamplerEngine | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);

	// Initialize on mount
	useEffect(() => {
		// Create audio context
		const ctx = new AudioContext();
		audioContextRef.current = ctx;

		// Create engine
		const engine = new SamplerEngine(ctx, {
			padCount: 16,
			defaultVoices: 8,
			maxVoices: 32,
		});
		engine.connect(ctx.destination);
		engineRef.current = engine;

		// Sync initial pads
		setPads(engine.getAllPads());
		setIsReady(true);

		// Cleanup
		return () => {
			engine.dispose();
			ctx.close();
		};
	}, []);

	// Sync pads from engine
	const syncPads = useCallback(() => {
		if (engineRef.current) {
			setPads(engineRef.current.getAllPads());
		}
	}, []);

	// Resume audio context (required for browsers)
	const ensureAudioReady = useCallback(async () => {
		const ctx = audioContextRef.current;
		if (ctx && ctx.state === "suspended") {
			await ctx.resume();
		}
	}, []);

	// Select pad
	const selectPad = useCallback((padId: string | null) => {
		setSelectedPadId(padId);
	}, []);

	// Trigger pad
	const triggerPad = useCallback(
		async (padId: string, velocity = 100) => {
			await ensureAudioReady();
			const engine = engineRef.current;
			if (!engine) return;

			const pad = engine.getPad(padId);
			if (!pad) return;

			engine.triggerAttack(pad.triggerNote, velocity);
		},
		[ensureAudioReady],
	);

	// Release pad
	const releasePad = useCallback((padId: string) => {
		const engine = engineRef.current;
		if (!engine) return;

		const pad = engine.getPad(padId);
		if (!pad) return;

		engine.triggerRelease(pad.triggerNote);
	}, []);

	// Load sample from file
	const loadSample = useCallback(
		async (padId: string, file: File): Promise<string | null> => {
			await ensureAudioReady();
			const engine = engineRef.current;
			const ctx = audioContextRef.current;
			if (!engine || !ctx) return "Sampler not ready";

			try {
				const arrayBuffer = await file.arrayBuffer();
				const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

				engine.loadSample(padId, audioBuffer);
				engine.updatePad(padId, {
					name: file.name.replace(/\.[^/.]+$/, ""),
				});

				syncPads();
				return null;
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Failed to decode audio";
				console.error("Failed to load sample:", err);
				return msg;
			}
		},
		[ensureAudioReady, syncPads],
	);

	// Clear sample
	const clearSample = useCallback(
		(padId: string) => {
			const engine = engineRef.current;
			if (!engine) return;

			engine.clearSample(padId);
			syncPads();
		},
		[syncPads],
	);

	// Update pad
	const updatePad = useCallback(
		(padId: string, updates: Partial<SamplerPad>) => {
			const engine = engineRef.current;
			if (!engine) return;

			engine.updatePad(padId, updates);
			syncPads();
		},
		[syncPads],
	);

	// Update envelope
	const updateEnvelope = useCallback(
		(padId: string, envelope: Partial<ADSREnvelope>) => {
			const engine = engineRef.current;
			if (!engine) return;

			const pad = engine.getPad(padId);
			if (!pad) return;

			engine.updatePad(padId, {
				envelope: { ...pad.envelope, ...envelope },
			});
			syncPads();
		},
		[syncPads],
	);

	// Stop all
	const stopAll = useCallback(() => {
		const engine = engineRef.current;
		if (!engine) return;

		engine.stopAllVoices();
	}, []);

	// Visual feedback helpers
	const setPadActive = useCallback((padId: string) => {
		setActivePadIds((prev) => new Set(prev).add(padId));
	}, []);

	const setPadInactive = useCallback((padId: string) => {
		setActivePadIds((prev) => {
			const next = new Set(prev);
			next.delete(padId);
			return next;
		});
	}, []);

	// Memoize context value
	const value = useMemo<SamplerContextValue>(
		() => ({
			isReady,
			pads,
			selectedPadId,
			activePadIds,
			selectPad,
			triggerPad,
			releasePad,
			loadSample,
			clearSample,
			updatePad,
			updateEnvelope,
			stopAll,
			setPadActive,
			setPadInactive,
		}),
		[
			isReady,
			pads,
			selectedPadId,
			activePadIds,
			selectPad,
			triggerPad,
			releasePad,
			loadSample,
			clearSample,
			updatePad,
			updateEnvelope,
			stopAll,
			setPadActive,
			setPadInactive,
		],
	);

	return (
		<SamplerContext.Provider value={value}>{children}</SamplerContext.Provider>
	);
}

// ============================================================================
// Hook
// ============================================================================

export function useSamplerContext() {
	const ctx = useContext(SamplerContext);
	if (!ctx) {
		throw new Error("useSamplerContext must be used within SamplerProvider");
	}
	return ctx;
}
