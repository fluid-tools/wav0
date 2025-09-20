"use client";

import type { Track, Clip } from "@/lib/state/daw-store";
import { audioManager } from "./audio-manager";

export interface PlaybackOptions {
	startTime?: number; // seconds
	onTimeUpdate?: (time: number) => void; // seconds
	onPlaybackEnd?: () => void;
}

type ClipPlaybackState = {
	iterator: AsyncIterableIterator<{
		buffer: AudioBuffer;
		timestamp: number;
	}> | null;
	gainNode: GainNode | null;
	audioSources: AudioBufferSourceNode[];
};

type TrackPlaybackState = {
	clipStates: Map<string, ClipPlaybackState>;
	gainNode: GainNode | null; // track-level gain (volume/solo/mute)
	isPlaying: boolean;
};

/**
 * PlaybackEngine based on MediaBunny player implementation pattern
 * Updated: per-clip scheduling so multiple clips per track play correctly
 */
export class PlaybackEngine {
	private static instance: PlaybackEngine;
	private audioContext: AudioContext | null = null;
	private masterGainNode: GainNode | null = null;
	private tracks = new Map<string, TrackPlaybackState>();
	private isPlaying = false;
	private startTime = 0; // AudioContext.currentTime when play() called
	private playbackTimeAtStart = 0; // seconds
	private options: PlaybackOptions = {};
	private animationFrameId: number | null = null;
	private queuedAudioNodes = new Set<AudioBufferSourceNode>();

	private constructor() {}

	static getInstance(): PlaybackEngine {
		if (!PlaybackEngine.instance) {
			PlaybackEngine.instance = new PlaybackEngine();
		}
		return PlaybackEngine.instance;
	}

	private async getAudioContext(): Promise<AudioContext> {
		if (!this.audioContext) {
			this.audioContext = await audioManager.getAudioContext();
			this.masterGainNode = this.audioContext.createGain();
			this.masterGainNode.connect(this.audioContext.destination);
		}
		return this.audioContext;
	}

	// Current playback time (seconds)
	private getPlaybackTime(): number {
		if (this.isPlaying && this.audioContext) {
			return (
				this.audioContext.currentTime -
				this.startTime +
				this.playbackTimeAtStart
			);
		} else {
			return this.playbackTimeAtStart;
		}
	}

	// Initialize track state if it has any loaded audio (clip or legacy)
	async initializeWithTracks(tracks: Track[]): Promise<void> {
		await this.getAudioContext();
		this.tracks.clear();

		for (const track of tracks) {
			const hasLoadedClip = (track.clips ?? []).some((c) =>
				c.opfsFileId ? audioManager.isTrackLoaded(c.opfsFileId) : false,
			);
			const hasLoadedLegacy = track.opfsFileId
				? audioManager.isTrackLoaded(track.opfsFileId)
				: false;
			if (hasLoadedClip || hasLoadedLegacy) {
				this.tracks.set(track.id, {
					clipStates: new Map(),
					gainNode: null,
					isPlaying: false,
				});
			}
		}
	}

	// Start playback from a specific time (seconds)
	async play(tracks: Track[], options: PlaybackOptions = {}): Promise<void> {
		this.options = options;

		if (this.isPlaying) {
			await this.pause();
		}

		await this.getAudioContext();
		if (!this.audioContext || !this.masterGainNode) {
			throw new Error("AudioContext not initialized");
		}

		this.playbackTimeAtStart = options.startTime || 0;
		this.startTime = this.audioContext.currentTime;
		this.isPlaying = true;

		const hasAnyTracksInSolo = tracks.some((t) => t.soloed);

		for (const track of tracks) {
			if (track.muted) continue;
			const trackState = this.tracks.get(track.id);
			if (!trackState) continue;

			// Create/update track gain
			if (!trackState.gainNode) {
				trackState.gainNode = this.audioContext.createGain();
				trackState.gainNode.connect(this.masterGainNode);
			}
			const baseVolume = track.volume / 100;
			trackState.gainNode.gain.value = hasAnyTracksInSolo
				? track.soloed
					? baseVolume
					: 0
				: baseVolume;

			trackState.isPlaying = true;

			const clips =
				track.clips && track.clips.length > 0
					? track.clips
					: track.opfsFileId
						? [
								{
									id: track.id,
									name: track.name,
									opfsFileId: track.opfsFileId,
									startTime: track.startTime,
									trimStart: track.trimStart,
									trimEnd: track.trimEnd,
									color: track.color,
								} as Clip,
							]
						: [];

			for (const clip of clips) {
				if (!clip.opfsFileId) continue;
				const sink = audioManager.getAudioBufferSink(clip.opfsFileId);
				if (!sink) continue;

				const clipStartSec = clip.startTime / 1000;
				const clipTrimStartSec = clip.trimStart / 1000;
				const clipTrimEndSec = clip.trimEnd / 1000;
				const clipDurationSec = clipTrimEndSec - clipTrimStartSec;
				const clipEndSec = clipStartSec + clipDurationSec;

				// Skip if playback starts after this clip
				if (this.playbackTimeAtStart >= clipEndSec) continue;

				const timeIntoClip = Math.max(
					0,
					this.playbackTimeAtStart - clipStartSec,
				);
				const audioFileReadStart = clipTrimStartSec + timeIntoClip;
				if (audioFileReadStart >= clipTrimEndSec) continue;

				// Prepare clip playback state
				let cps = trackState.clipStates.get(clip.id);
				if (!cps) {
					cps = {
						iterator: null,
						gainNode: this.audioContext.createGain(),
						audioSources: [],
					};
					cps.gainNode!.connect(trackState.gainNode!);
					trackState.clipStates.set(clip.id, cps);
				}

				// Configure clip fades (basic linear ramps)
				try {
					const clipGain = cps.gainNode!;
					clipGain.gain.cancelScheduledValues(0);
					clipGain.gain.setValueAtTime(1, 0);
					const clipStartAC =
						this.startTime + clipStartSec - this.playbackTimeAtStart;
					const clipEndAC =
						this.startTime + clipEndSec - this.playbackTimeAtStart;
					if (clip.fadeIn && clip.fadeIn > 0) {
						clipGain.gain.setValueAtTime(0, Math.max(0, clipStartAC));
						clipGain.gain.linearRampToValueAtTime(
							1,
							Math.max(0, clipStartAC + clip.fadeIn / 1000),
						);
					}
					if (clip.fadeOut && clip.fadeOut > 0) {
						clipGain.gain.setValueAtTime(
							1,
							Math.max(0, clipEndAC - clip.fadeOut / 1000),
						);
						clipGain.gain.linearRampToValueAtTime(0, Math.max(0, clipEndAC));
					}
				} catch (e) {
					console.warn("Failed to schedule clip fades", e);
				}

				// Start buffers iterator for this clip
				cps.iterator = sink.buffers(audioFileReadStart, clipTrimEndSec);
				// Fire-and-forget so multiple clips run concurrently
				this.runClipAudioIterator(
					track,
					clip,
					cps,
					clipStartSec,
					clipTrimStartSec,
				);
			}
		}

		this.startTimeUpdateLoop();
	}

	private async runClipAudioIterator(
		track: Track,
		clip: Clip,
		cps: ClipPlaybackState,
		clipStartSec: number,
		clipTrimStartSec: number,
	): Promise<void> {
		if (!cps.iterator || !this.audioContext) return;
		const clipGain = cps.gainNode;
		try {
			for await (const { buffer, timestamp } of cps.iterator) {
				if (!this.isPlaying) break;
				// Create node per buffer
				const node = this.audioContext.createBufferSource();
				node.buffer = buffer;
				node.connect(clipGain ?? this.masterGainNode!);

				// timeline position mapping
				const timeInTrimmed = timestamp - clipTrimStartSec;
				const timelinePos = clipStartSec + timeInTrimmed;
				const startAt = this.startTime + timelinePos - this.playbackTimeAtStart;

				if (startAt >= this.audioContext.currentTime) {
					node.start(startAt);
				} else {
					const offset = this.audioContext.currentTime - startAt;
					if (offset < buffer.duration) {
						node.start(this.audioContext.currentTime, offset);
					} else {
						continue; // too late
					}
				}

				cps.audioSources.push(node);
				this.queuedAudioNodes.add(node);
				node.onended = () => {
					const idx = cps.audioSources.indexOf(node);
					if (idx > -1) cps.audioSources.splice(idx, 1);
					this.queuedAudioNodes.delete(node);
				};

				// Throttle scheduling when far ahead
				const currentTimeline = this.getPlaybackTime();
				if (timelinePos - currentTimeline >= 1) {
					await new Promise((resolve) => {
						const id = setInterval(() => {
							if (timelinePos - this.getPlaybackTime() < 1 || !this.isPlaying) {
								clearInterval(id);
								resolve(undefined);
							}
						}, 100);
					});
				}
			}
		} catch (e) {
			console.error("Error in clip audio iterator:", track.name, clip.name, e);
		}
	}

	async pause(): Promise<void> {
		this.playbackTimeAtStart = this.getPlaybackTime();
		this.isPlaying = false;

		// Stop all iterators and nodes
		for (const trackState of this.tracks.values()) {
			trackState.isPlaying = false;
			for (const cps of trackState.clipStates.values()) {
				await cps.iterator?.return?.(undefined);
				cps.iterator = null;
				for (const node of [...cps.audioSources]) {
					try {
						node.stop();
					} catch {}
				}
				cps.audioSources = [];
			}
		}

		for (const node of this.queuedAudioNodes) {
			try {
				node.stop();
			} catch {}
		}
		this.queuedAudioNodes.clear();

		this.stopTimeUpdateLoop();
	}

	async stop(): Promise<void> {
		await this.pause();
		this.playbackTimeAtStart = 0;
		this.options.onTimeUpdate?.(0);
	}

	async seek(time: number): Promise<void> {
		const wasPlaying = this.isPlaying;
		if (wasPlaying) await this.pause();
		this.playbackTimeAtStart = time;
		this.options.onTimeUpdate?.(time);
	}

	// Reschedule given track (rebuild all clip iterators) during playback
	async rescheduleTrack(updatedTrack: Track): Promise<void> {
		if (!this.isPlaying) return;
		await this.getAudioContext();
		if (!this.audioContext) return;
		let trackState = this.tracks.get(updatedTrack.id);
		if (!trackState) {
			trackState = { clipStates: new Map(), gainNode: null, isPlaying: true };
			this.tracks.set(updatedTrack.id, trackState);
		}

		// Stop all existing clip iterators/nodes
		trackState.isPlaying = false;
		for (const cps of trackState.clipStates.values()) {
			await cps.iterator?.return?.(undefined);
			cps.iterator = null;
			for (const node of [...cps.audioSources]) {
				try {
					node.stop();
				} catch {}
			}
			cps.audioSources = [];
		}

		// Ensure track gain exists
		if (!trackState.gainNode) {
			trackState.gainNode = this.audioContext.createGain();
			trackState.gainNode.connect(this.masterGainNode!);
		}

		trackState.isPlaying = true;

		// Rebuild clip states and schedule again
		const hasClips = updatedTrack.clips && updatedTrack.clips.length > 0;
		const clips: Clip[] = hasClips
			? (updatedTrack.clips as Clip[])
			: updatedTrack.opfsFileId
				? [
						{
							id: updatedTrack.id,
							name: updatedTrack.name,
							opfsFileId: updatedTrack.opfsFileId,
							startTime: updatedTrack.startTime,
							trimStart: updatedTrack.trimStart,
							trimEnd: updatedTrack.trimEnd,
							color: updatedTrack.color,
						} as Clip,
					]
				: [];

		for (const clip of clips) {
			if (!clip.opfsFileId) continue;
			const sink = audioManager.getAudioBufferSink(clip.opfsFileId);
			if (!sink) continue;

			const clipStartSec = clip.startTime / 1000;
			const clipTrimStartSec = clip.trimStart / 1000;
			const clipTrimEndSec = clip.trimEnd / 1000;
			const clipEndSec = clipStartSec + (clipTrimEndSec - clipTrimStartSec);
			const now = this.getPlaybackTime();
			if (now >= clipEndSec) continue;

			const timeIntoClip = Math.max(0, now - clipStartSec);
			const audioFileReadStart = Math.min(
				clipTrimEndSec,
				clipTrimStartSec + timeIntoClip,
			);
			if (audioFileReadStart >= clipTrimEndSec) continue;

			let cps = trackState.clipStates.get(clip.id);
			if (!cps) {
				cps = {
					iterator: null,
					gainNode: this.audioContext.createGain(),
					audioSources: [],
				};
				cps.gainNode!.connect(trackState.gainNode!);
				trackState.clipStates.set(clip.id, cps);
			}

			// Reapply fades
			try {
				const clipGain = cps.gainNode!;
				clipGain.gain.cancelScheduledValues(0);
				clipGain.gain.setValueAtTime(1, 0);
				const clipStartAC =
					this.startTime + clipStartSec - this.playbackTimeAtStart;
				const clipEndAC =
					this.startTime + clipEndSec - this.playbackTimeAtStart;
				if (clip.fadeIn && clip.fadeIn > 0) {
					clipGain.gain.setValueAtTime(0, Math.max(0, clipStartAC));
					clipGain.gain.linearRampToValueAtTime(
						1,
						Math.max(0, clipStartAC + clip.fadeIn / 1000),
					);
				}
				if (clip.fadeOut && clip.fadeOut > 0) {
					clipGain.gain.setValueAtTime(
						1,
						Math.max(0, clipEndAC - clip.fadeOut / 1000),
					);
					clipGain.gain.linearRampToValueAtTime(0, Math.max(0, clipEndAC));
				}
			} catch {}

			cps.iterator = sink.buffers(audioFileReadStart, clipTrimEndSec);
			this.runClipAudioIterator(
				updatedTrack,
				clip,
				cps,
				clipStartSec,
				clipTrimStartSec,
			);
		}
	}

	getCurrentTime(): number {
		return this.getPlaybackTime();
	}

	getIsPlaying(): boolean {
		return this.isPlaying;
	}

	private startTimeUpdateLoop(): void {
		const updateTime = () => {
			if (!this.isPlaying) return;
			const currentTime = this.getPlaybackTime();
			this.options.onTimeUpdate?.(currentTime);
			this.animationFrameId = requestAnimationFrame(updateTime);
		};
		updateTime();
	}

	private stopTimeUpdateLoop(): void {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	updateTrackVolume(trackId: string, volume: number): void {
		const trackState = this.tracks.get(trackId);
		if (trackState?.gainNode) {
			trackState.gainNode.gain.value = volume / 100;
		}
	}

	updateTrackMute(trackId: string, muted: boolean): void {
		const trackState = this.tracks.get(trackId);
		if (trackState?.gainNode) {
			trackState.gainNode.gain.value = muted ? 0 : 1;
		}
	}

	updateMasterVolume(volume: number): void {
		if (this.masterGainNode) {
			this.masterGainNode.gain.value = volume / 100;
		}
	}

	cleanup(): void {
		this.stop();
		this.tracks.clear();
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
			this.masterGainNode = null;
		}
	}
}

export const playbackEngine = PlaybackEngine.getInstance();
