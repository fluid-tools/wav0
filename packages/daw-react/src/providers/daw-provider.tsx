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

	// IMMEDIATE registration of legacy services (synchronous, during render)
	// This ensures services are available BEFORE any child effects run
	// React effects run child-to-parent, so without this, child effects would
	// fail with "Audio service not registered"
	if (!initialRegistrationDone.current && legacyAudioService) {
		registerServices({
			audioService: legacyAudioService,
			playbackService: legacyPlaybackService,
		});
		initialRegistrationDone.current = true;
	}

	// Set storage adapter synchronously if provided (before effects)
	if (storageAdapter) {
		setStorageAdapter(storageAdapter);
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
	// null means DAW not ready yet - return null bridges gracefully
	if (!context) {
		return {
			audio: null,
			playback: null,
		};
	}
	return {
		audio: context.audioBridge,
		playback: context.playbackBridge,
	};
}
