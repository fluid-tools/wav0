/**
 * DAW Provider - App-wide SDK access via React Context
 *
 * Service Registration Strategy:
 * When DAW becomes available, SDK services are registered to service registry
 * for atoms to access. The provider creates wrapper objects that match the
 * interface atoms expect.
 */

"use client";

import type { DAW, DAWConfig, Track } from "@wav0/daw-sdk";
import { useStore } from "jotai";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";
import {
	registerServices,
	servicesAtom,
	type AudioService,
	type PlaybackService,
} from "../atoms/service-registry";
import { useDAW } from "../hooks/use-daw";
import { type StorageAdapter, setStorageAdapter } from "../storage/adapter";

interface DAWContextValue {
	daw: DAW;
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
	const store = useStore();

	// Track the last storage adapter to avoid redundant calls on every render
	const lastStorageAdapterRef = useRef<StorageAdapter | undefined>(undefined);

	// Set storage adapter only when it changes (avoid redundant calls on render)
	useEffect(() => {
		if (!storageAdapter) return;
		if (storageAdapter === lastStorageAdapterRef.current) return;
		setStorageAdapter(storageAdapter);
		lastStorageAdapterRef.current = storageAdapter;
	}, [storageAdapter]);

	// Register SDK services directly to service registry (no bridges)
	useEffect(() => {
		if (!daw) return;

		const audioEngine = daw.getAudioEngine();
		const transport = daw.getTransport();

		// Create service wrappers that match the interface atoms expect
		// These are thin wrappers that adapt SDK methods to the service registry interface
		const audioService = {
			async loadAudioFile(file: File, opfsFileId: string) {
				const audioData = await audioEngine.loadAudio(file, opfsFileId);
				// Save to OPFS
				const arrayBuffer = await file.arrayBuffer();
				try {
					await audioEngine.saveToOPFS(opfsFileId, arrayBuffer);
				} catch (error) {
					console.warn("[DAWProvider] OPFS save failed:", error);
				}
				return {
					...audioData,
					fileName: file.name,
					fileType: file.type,
				};
			},
			async loadTrackFromOPFS(opfsFileId: string, fileName: string) {
				await audioEngine.loadFromOPFS(opfsFileId, fileName);
			},
			async getAudioBuffer(opfsFileId: string, fileName: string) {
				return audioEngine.getAudioBuffer(opfsFileId, fileName);
			},
		};

		const playbackService = {
			async play(
				tracks: Track[],
				options: {
					startTime?: number;
					onTimeUpdate?: (time: number) => void;
					onPlaybackEnd?: () => void;
				},
			) {
				// Set up event listeners for callbacks
				const cleanupFns: (() => void)[] = [];

				if (options.onTimeUpdate) {
					const handleTimeUpdate = ((event: CustomEvent) => {
						// SDK Transport sends ms, callback expects seconds
						options.onTimeUpdate?.(event.detail.currentTime / 1000);
					}) as EventListener;
					transport.addEventListener("time-update", handleTimeUpdate);
					cleanupFns.push(() =>
						transport.removeEventListener("time-update", handleTimeUpdate),
					);
				}

				if (options.onPlaybackEnd) {
					// Debounced handler to avoid false positives from internal stop→play cycles
					let stopDebounce: ReturnType<typeof setTimeout> | null = null;
					const handleStop = ((event: CustomEvent) => {
						if (event.detail.type === "stop") {
							if (stopDebounce) clearTimeout(stopDebounce);
							stopDebounce = setTimeout(() => {
								stopDebounce = null;
								if (transport.getState() !== "playing") {
									options.onPlaybackEnd?.();
								}
							}, 50);
						} else if (event.detail.type === "play") {
							if (stopDebounce) {
								clearTimeout(stopDebounce);
								stopDebounce = null;
							}
						}
					}) as EventListener;
					transport.addEventListener("transport", handleStop);
					cleanupFns.push(() => {
						if (stopDebounce) clearTimeout(stopDebounce);
						transport.removeEventListener("transport", handleStop);
					});
				}

				// Play via SDK Transport (convert seconds to ms)
				const startTimeMs = (options.startTime ?? 0) * 1000;
				await transport.play(tracks, startTimeMs);
			},
			async seek(timeMs: number) {
				transport.seek(timeMs);
			},
			async pause() {
				transport.pause();
			},
			async stop() {
				transport.stop();
			},
			async synchronizeTracks(tracks: Track[]) {
				await transport.synchronizeTracks(tracks);
			},
			async rescheduleTrack(track: Track, allTracks?: Track[]) {
				await transport.synchronizeTracks(allTracks ?? [track]);
			},
			updateTrackVolume(trackId: string, volumeDb: number) {
				transport.updateTrackVolume(trackId, volumeDb);
			},
			updateTrackVolumeRealtime(trackId: string, volumeDb: number) {
				transport.updateTrackVolumeRealtime(trackId, volumeDb);
			},
			updateTrackMute(
				trackId: string,
				muted: boolean,
				isSoloed: boolean,
				soloEngaged: boolean,
			) {
				transport.updateTrackMute(trackId, muted, isSoloed, soloEngaged);
			},
			updateSoloStates(tracks: Track[]) {
				transport.updateSoloStates(tracks);
			},
			async initializeWithTracks(tracks: Track[]) {
				await transport.initializeWithTracks(tracks);
			},
			getMasterDb() {
				return transport.getMasterDb();
			},
		};

		// Register services to both:
		// 1. servicesAtom (for atoms using get(servicesAtom))
		// 2. Legacy serviceRegistry (for backwards compatibility during migration)
		store.set(servicesAtom, {
			audioService: audioService as AudioService,
			playbackService: playbackService as PlaybackService,
			generateTrackId: null,
		});

		// Legacy registration (deprecated, will be removed)
		registerServices({
			audioService,
			playbackService,
		});

		return () => {
			// Clear services on cleanup
			store.set(servicesAtom, {
				audioService: null,
				playbackService: null,
				generateTrackId: null,
			});
		};
	}, [daw, store]);

	// useMemo required - context values need stable references
	const contextValue = useMemo<DAWContextValue | null>(
		() =>
			daw
				? {
						daw,
					}
				: null,
		[daw],
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
