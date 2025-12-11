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

	// Set storage adapter only when it changes (avoid redundant calls on render)
	useEffect(() => {
		if (!storageAdapter) return;
		if (storageAdapter === lastStorageAdapterRef.current) return;
		setStorageAdapter(storageAdapter);
		lastStorageAdapterRef.current = storageAdapter;
	}, [storageAdapter]);

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

	// useMemo required - context values need stable references
	const contextValue = useMemo<DAWContextValue | null>(
		() =>
			daw
				? {
						daw,
						audioBridge: bridges.audio,
						playbackBridge: bridges.playback,
					}
				: null,
		[daw, bridges.audio, bridges.playback],
	);

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
	// useMemo required for stable reference - consumers depend on this
	return useMemo(
		() => ({
			audio: context?.audioBridge ?? null,
			playback: context?.playbackBridge ?? null,
		}),
		[context?.audioBridge, context?.playbackBridge],
	);
}
