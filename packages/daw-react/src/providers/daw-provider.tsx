/**
 * DAW Provider - App-wide SDK access via React Context
 */

"use client";

import type { DAW, DAWConfig } from "@wav0/daw-sdk";
import { Provider as JotaiProvider } from "jotai";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
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

	// Set storage adapter if provided
	useEffect(() => {
		if (storageAdapter) {
			setStorageAdapter(storageAdapter);
		}
	}, [storageAdapter]);

	// Setup bridges if legacy services provided
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

		return () => {
			audioBridge?.dispose();
			playbackBridge?.dispose();
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
		<DAWContext.Provider value={contextValue}>
			<JotaiProvider>{children}</JotaiProvider>
		</DAWContext.Provider>
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
	if (!context) {
		throw new Error("useBridges must be used within DAWProvider");
	}
	return {
		audio: context.audioBridge,
		playback: context.playbackBridge,
	};
}
