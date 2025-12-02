/**
 * DAW Provider - App-wide SDK access via React Context
 *
 * Service Registration Strategy:
 * When DAW becomes available, bridges are created and registered to service registry
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
}

export function DAWProvider({
	children,
	config,
	storageAdapter,
}: DAWProviderProps) {
	const daw = useDAW(config);
	const [bridges, setBridges] = useState<{
		audio: AudioServiceBridge | null;
		playback: PlaybackServiceBridge | null;
	}>({ audio: null, playback: null });

	// Track the last storage adapter to avoid redundant calls on every render
	const lastStorageAdapterRef = useRef<StorageAdapter | undefined>(undefined);

	// Set storage adapter only when it changes (avoid redundant calls on every render)
	if (storageAdapter && storageAdapter !== lastStorageAdapterRef.current) {
		setStorageAdapter(storageAdapter);
		lastStorageAdapterRef.current = storageAdapter;
	}

	// Setup bridges and register them to service registry
	useEffect(() => {
		if (!daw) return;

		const audioBridge = new AudioServiceBridge(daw);
		const playbackBridge = new PlaybackServiceBridge(daw);

		setBridges({ audio: audioBridge, playback: playbackBridge });

		// Register bridges to service registry
		registerServices({
			audioService: audioBridge,
			playbackService: playbackBridge,
		});

		return () => {
			audioBridge?.dispose();
			playbackBridge?.dispose();
		};
	}, [daw]);

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
