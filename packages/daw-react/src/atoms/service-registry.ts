/**
 * Services Atom
 * Reactive service references using Jotai atoms instead of global singleton
 *
 * Benefits:
 * - Services are part of the Jotai store (not global mutable state)
 * - Atoms can access services via get(servicesAtom)
 * - Provider sets services via store.set(servicesAtom, services)
 * - SSR-safe (no global state pollution)
 */

import type { Track } from "@wav0/daw-sdk";
import { atom } from "jotai";

export interface AudioService {
	loadAudioFile: (
		file: File,
		opfsFileId: string,
	) => Promise<{
		id: string;
		duration: number;
		sampleRate: number;
		numberOfChannels: number;
		fileName: string;
		fileType: string;
	}>;
	loadTrackFromOPFS: (opfsFileId: string, fileName: string) => Promise<void>;
	getAudioBuffer: (
		opfsFileId: string,
		fileName: string,
	) => Promise<AudioBuffer | null>;
}

export interface PlaybackService {
	play: (
		tracks: Track[],
		options: {
			startTime?: number;
			onTimeUpdate?: (time: number) => void;
			onPlaybackEnd?: () => void;
		},
	) => Promise<void>;
	seek: (timeMs: number) => Promise<void>;
	pause: () => Promise<void>;
	stop: () => Promise<void>;
	synchronizeTracks: (tracks: Track[]) => Promise<void>;
	rescheduleTrack: (track: Track, allTracks?: Track[]) => Promise<void>;
	updateTrackVolume: (trackId: string, volume: number) => void;
	updateTrackVolumeRealtime: (trackId: string, volumeDb: number) => void;
	updateTrackMute: (
		trackId: string,
		muted: boolean,
		isSoloed: boolean,
		soloEngaged: boolean,
	) => void;
	updateSoloStates: (tracks: Track[]) => void;
	initializeWithTracks: (tracks: Track[]) => Promise<void>;
	getMasterDb: () => number;
}

export interface Services {
	audioService: AudioService | null;
	playbackService: PlaybackService | null;
	generateTrackId: (() => string) | null;
}

/**
 * Services atom - holds references to audio and playback services
 * Set by DAWProvider when DAW is initialized
 */
export const servicesAtom = atom<Services>({
	audioService: null,
	playbackService: null,
	generateTrackId: null,
});

// Legacy exports for backwards compatibility during migration
// TODO: Remove after Phase 2 is complete

/**
 * @deprecated Use servicesAtom instead
 */
export interface ServiceRegistry {
	audioService?: AudioService;
	playbackService?: PlaybackService;
	generateTrackId?: () => string;
}

/**
 * @deprecated Use servicesAtom instead - this global object will be removed
 */
export const serviceRegistry: ServiceRegistry = {};

/**
 * @deprecated Use store.set(servicesAtom, services) instead
 */
export function registerServices(services: Partial<ServiceRegistry>): void {
	Object.assign(serviceRegistry, services);
}
