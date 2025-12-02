/**
 * Shared Service Registry
 * Single source of truth for service references across all atom files
 */

import type { Track } from "@wav0/daw-sdk";

export interface ServiceRegistry {
	audioService?: {
		loadAudioFile: (file: File, opfsFileId: string) => Promise<any>;
		loadTrackFromOPFS: (opfsFileId: string, fileName: string) => Promise<void>;
		getAudioBuffer: (
			opfsFileId: string,
			fileName: string,
		) => Promise<AudioBuffer | null>;
	};
	playbackService?: {
		play: (
			tracks: Track[],
			options: {
				startTime?: number;
				onTimeUpdate?: (time: number) => void;
				onPlaybackEnd?: () => void;
			},
		) => Promise<void>;
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
	};
	generateTrackId?: () => string;
}

export const serviceRegistry: ServiceRegistry = {};

export function registerServices(services: Partial<ServiceRegistry>): void {
	Object.assign(serviceRegistry, services);
}

