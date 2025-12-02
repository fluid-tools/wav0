/**
 * DAW Provider - App-wide SDK access via React Context
 *
 * Service Registration Strategy:
 * 1. Legacy services are registered SYNCHRONOUSLY during render (before any effects)
 * 2. When DAW becomes available, bridges are created and RE-REGISTERED (upgrading from legacy)
 * 3. This ensures services are always available for child effects
 */

"use client";

import type { DAW, DAWConfig } from "@wav0/daw-sdk";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { registerServices } from "../atoms/service-registry";
import { AudioServiceBridge, PlaybackServiceBridge } from "../bridges";
import { useDAW } from "../hooks/use-daw";
import { type StorageAdapter, setStorageAdapter } from "../storage/adapter";

interface DAWContextValue {
	daw: DAW;
	audioBridge: AudioServiceBridge | null;
	playbackBridge: PlaybackServiceBridge | null;
}

const DAWContext = createContext<DAWContextValue | null>(null);

export interface DAWProviderProps {
	children: ReactNode;
	config?: DAWConfig;
	storageAdapter?: StorageAdapter;
	/** Legacy playback service - still required during migration (Phase 3/4) */
	// biome-ignore lint/suspicious/noExplicitAny: Legacy service interface during migration
	legacyPlaybackService?: any;
}

export function DAWProvider({
	children,
	config,
	storageAdapter,
	legacyPlaybackService,
}: DAWProviderProps) {
	const daw = useDAW(config);
	const [bridges, setBridges] = useState<{
		audio: AudioServiceBridge | null;
		playback: PlaybackServiceBridge | null;
	}>({ audio: null, playback: null });

	// Track if we've done initial registration to avoid redundant calls
	const initialRegistrationDone = useRef(false);
	// Track the last storage adapter to avoid redundant calls on every render
	const lastStorageAdapterRef = useRef<StorageAdapter | undefined>(undefined);
	// Track last registered playback service to detect prop changes before DAW is ready
	const lastPlaybackServiceRef = useRef(legacyPlaybackService);

	// Check if playback service changed (props updated before DAW ready)
	const servicesChanged = lastPlaybackServiceRef.current !== legacyPlaybackService;

	// IMMEDIATE registration of legacy playback service (synchronous, during render)
	// This ensures playback service is available BEFORE any child effects run
	// Audio service is SDK-only and will be registered when DAW becomes available
	// React effects run child-to-parent, so without this, child effects would
	// fail with "Playback service not registered"
	if (
		(!initialRegistrationDone.current || servicesChanged) &&
		legacyPlaybackService
	) {
		registerServices({
			playbackService: legacyPlaybackService,
		});
		initialRegistrationDone.current = true;
		lastPlaybackServiceRef.current = legacyPlaybackService;
	}

	// Set storage adapter only when it changes (avoid redundant calls on every render)
	if (storageAdapter && storageAdapter !== lastStorageAdapterRef.current) {
		setStorageAdapter(storageAdapter);
		lastStorageAdapterRef.current = storageAdapter;
	}

	// Setup bridges and RE-REGISTER them to service registry
	// AudioBridge uses SDK exclusively (no legacy fallback)
	// PlaybackBridge still uses legacy during migration (Phase 3/4)
	useEffect(() => {
		if (!daw) return;

		// AudioBridge: SDK-only, no legacy dependency
		const audioBridge = new AudioServiceBridge(daw);
		let playbackBridge: PlaybackServiceBridge | null = null;

		if (legacyPlaybackService) {
			playbackBridge = new PlaybackServiceBridge(daw, legacyPlaybackService);
		}

		setBridges({ audio: audioBridge, playback: playbackBridge });

		// RE-REGISTER with bridges
		// AudioBridge is always SDK-only
		// PlaybackBridge falls back to legacy if bridge not available
		registerServices({
			audioService: audioBridge,
			playbackService: playbackBridge ?? legacyPlaybackService,
		});

		return () => {
			audioBridge?.dispose();
			playbackBridge?.dispose();
			// On cleanup, fall back to legacy playback service only
			// Audio service is always SDK bridge (no legacy fallback)
			registerServices({
				audioService: audioBridge, // Keep SDK bridge even on cleanup
				playbackService: legacyPlaybackService,
			});
		};
	}, [daw, legacyPlaybackService]);

	// Don't block render - allow children to mount even if DAW not ready
	const contextValue: DAWContextValue | null = daw
		? {
				daw,
				audioBridge: bridges.audio,
				playbackBridge: bridges.playback,
			}
		: null;

	return (
		<DAWContext.Provider value={contextValue}>{children}</DAWContext.Provider>
	);
}

export function useDAWContext(): DAW | null {
	const context = useContext(DAWContext);
	if (context === undefined) {
		throw new Error("useDAWContext must be used within DAWProvider");
	}
	return context?.daw ?? null;
}

export function useBridges(): {
	audio: AudioServiceBridge | null;
	playback: PlaybackServiceBridge | null;
} {
	const context = useContext(DAWContext);
	// undefined means hook used outside provider - throw error
	if (context === undefined) {
		throw new Error("useBridges must be used within DAWProvider");
	}
	// Memoize to prevent new object reference on every render
	// This ensures useEffect dependencies on bridges work correctly
	const audioBridge = context?.audioBridge ?? null;
	const playbackBridge = context?.playbackBridge ?? null;
	return useMemo(
		() => ({
			audio: audioBridge,
			playback: playbackBridge,
		}),
		[audioBridge, playbackBridge],
	);
}
