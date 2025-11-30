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
	/** Legacy services for bridge pattern during migration */
	legacyAudioService?: any;
	legacyPlaybackService?: any;
}

export function DAWProvider({
	children,
	config,
	storageAdapter,
	legacyAudioService,
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
	// Track last registered services to detect prop changes before DAW is ready
	const lastAudioServiceRef = useRef(legacyAudioService);
	const lastPlaybackServiceRef = useRef(legacyPlaybackService);

	// Check if services changed (props updated before DAW ready)
	const servicesChanged =
		lastAudioServiceRef.current !== legacyAudioService ||
		lastPlaybackServiceRef.current !== legacyPlaybackService;

	// IMMEDIATE registration of legacy services (synchronous, during render)
	// This ensures services are available BEFORE any child effects run
	// React effects run child-to-parent, so without this, child effects would
	// fail with "Audio service not registered"
	// Bug fix: Check if EITHER service exists (not just audioService)
	// Bug fix: Only register services that are actually provided (not undefined)
	// Bug fix: Re-register if services changed before DAW is ready
	if (
		(!initialRegistrationDone.current || servicesChanged) &&
		(legacyAudioService || legacyPlaybackService)
	) {
		const servicesToRegister: Parameters<typeof registerServices>[0] = {};
		if (legacyAudioService) {
			servicesToRegister.audioService = legacyAudioService;
		}
		if (legacyPlaybackService) {
			servicesToRegister.playbackService = legacyPlaybackService;
		}
		registerServices(servicesToRegister);
		initialRegistrationDone.current = true;
		lastAudioServiceRef.current = legacyAudioService;
		lastPlaybackServiceRef.current = legacyPlaybackService;
	}

	// Set storage adapter only when it changes (avoid redundant calls on every render)
	if (storageAdapter && storageAdapter !== lastStorageAdapterRef.current) {
		setStorageAdapter(storageAdapter);
		lastStorageAdapterRef.current = storageAdapter;
	}

	// Setup bridges and RE-REGISTER them to service registry
	// Bridges wrap legacy services and provide SDK Transport integration
	// This upgrades from legacy services to bridges when DAW becomes available
	useEffect(() => {
		if (!daw) return;

		let audioBridge: AudioServiceBridge | null = null;
		let playbackBridge: PlaybackServiceBridge | null = null;

		if (legacyAudioService) {
			audioBridge = new AudioServiceBridge(daw, legacyAudioService);
		}

		if (legacyPlaybackService) {
			playbackBridge = new PlaybackServiceBridge(daw, legacyPlaybackService);
		}

		setBridges({ audio: audioBridge, playback: playbackBridge });

		// RE-REGISTER with bridges (upgrading from legacy)
		// Atoms calling serviceRegistry.playbackService will now get the bridge
		// which properly converts volume to dB for SDK Transport
		registerServices({
			audioService: audioBridge ?? legacyAudioService,
			playbackService: playbackBridge ?? legacyPlaybackService,
		});

		return () => {
			audioBridge?.dispose();
			playbackBridge?.dispose();
			// On cleanup, fall back to legacy services (not undefined)
			// This prevents "service not registered" errors during hot reload
			registerServices({
				audioService: legacyAudioService,
				playbackService: legacyPlaybackService,
			});
		};
	}, [daw, legacyAudioService, legacyPlaybackService]);

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
