"use client";

import type { Clip, Track } from "@/lib/state/daw-store";
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
	private prevTrackVolumes = new Map<string, number>();
	private DEBUG_AUDIO = false;
	private throttleIntervalId: ReturnType<typeof setInterval> | null = null;

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
				const clipDurationSec = Math.max(0, clipTrimEndSec - clipTrimStartSec);
				const clipOneShotEndSec = clipStartSec + clipDurationSec;
				const loopUntilSec = clip.loop
					? clip.loopEnd
						? clip.loopEnd / 1000
						: Number.POSITIVE_INFINITY
					: clipOneShotEndSec;

				// If playback starts after the loop/clip window, skip
				if (this.playbackTimeAtStart >= loopUntilSec) continue;

				let cycleOffsetSec = 0;
				let timeIntoClip = 0;
				if (clip.loop) {
					if (this.playbackTimeAtStart <= clipStartSec) {
						timeIntoClip = 0;
						cycleOffsetSec = 0;
					} else {
						const elapsed = this.playbackTimeAtStart - clipStartSec;
						const cycleIndex =
							clipDurationSec > 0 ? Math.floor(elapsed / clipDurationSec) : 0;
						cycleOffsetSec = cycleIndex * clipDurationSec;
						timeIntoClip = clipDurationSec > 0 ? elapsed - cycleOffsetSec : 0;
					}
				} else {
					timeIntoClip = Math.max(0, this.playbackTimeAtStart - clipStartSec);
				}
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
					if (cps.gainNode && trackState.gainNode) {
						cps.gainNode.connect(trackState.gainNode);
					}
					trackState.clipStates.set(clip.id, cps);
				}

				// Configure clip fades (basic linear ramps) — apply to one-shot segment only
				try {
					const clipGain = cps.gainNode ?? this.masterGainNode;
					if (!clipGain || !this.audioContext) continue;
					const now = this.audioContext.currentTime;
					// Reset automation from 'now' to avoid stale ramps
					if (
						typeof (clipGain.gain as any).cancelAndHoldAtTime === "function"
					) {
						(clipGain.gain as any).cancelAndHoldAtTime(now);
					} else {
						clipGain.gain.cancelScheduledValues(now);
						clipGain.gain.setValueAtTime(clipGain.gain.value ?? 1, now);
					}
					const clipStartAC =
						this.startTime + clipStartSec - this.playbackTimeAtStart;
					const loopEndSec = loopUntilSec;
					const loopEndAC =
						this.startTime + loopEndSec - this.playbackTimeAtStart;
					const oneShotEndAC =
						this.startTime + clipOneShotEndSec - this.playbackTimeAtStart;
					if (clip.fadeIn && clip.fadeIn > 0) {
						clipGain.gain.setValueAtTime(0, Math.max(now, clipStartAC));
						clipGain.gain.linearRampToValueAtTime(
							1,
							Math.max(now, clipStartAC + clip.fadeIn / 1000),
						);
					}
					// Only apply fadeOut at the final end: for loops, at loopEnd (if finite)
					if (clip.fadeOut && clip.fadeOut > 0) {
						const targetEnd = clip.loop
							? Number.isFinite(loopEndSec)
								? loopEndAC
								: null
							: oneShotEndAC;
						if (targetEnd !== null) {
							clipGain.gain.setValueAtTime(
								1,
								Math.max(now, targetEnd - clip.fadeOut / 1000),
							);
							clipGain.gain.linearRampToValueAtTime(
								0,
								Math.max(now, targetEnd),
							);
						}
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
					cycleOffsetSec,
					loopUntilSec,
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
		cycleOffsetSec: number = 0,
		loopUntilSec: number = Number.POSITIVE_INFINITY,
	): Promise<void> {
		if (!cps.iterator || !this.audioContext) return;
		const clipGain = cps.gainNode;
		const clipTrimEndSec = clip.trimEnd / 1000;
		const clipDurationSec = clipTrimEndSec - clipTrimStartSec;
		try {
			for await (const { buffer, timestamp } of cps.iterator) {
				if (!this.isPlaying) break;
				// Create node per buffer
				const node = this.audioContext.createBufferSource();
				node.buffer = buffer;
				node.connect(
					clipGain ?? this.masterGainNode ?? this.audioContext.destination,
				);

				// timeline position mapping
				const timeInTrimmed = timestamp - clipTrimStartSec;
				const timelinePos = clipStartSec + cycleOffsetSec + timeInTrimmed;
				if (timelinePos > loopUntilSec) {
					break; // don't schedule past loop end
				}
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
			// If clip loops, restart iterator for the next cycle within loopUntilSec
			if (this.isPlaying && clip.loop) {
				const sink = clip.opfsFileId
					? audioManager.getAudioBufferSink(clip.opfsFileId)
					: null;
				if (sink) {
					const nextCycleStart =
						cycleOffsetSec + clipDurationSec + clipStartSec;
					if (nextCycleStart < loopUntilSec) {
						cps.iterator = sink.buffers(clipTrimStartSec, clipTrimEndSec);
						// Fire-and-forget next cycle
						this.runClipAudioIterator(
							track,
							clip,
							cps,
							clipStartSec,
							clipTrimStartSec,
							cycleOffsetSec + clipDurationSec,
							loopUntilSec,
						);
					}
				}
			}
		} catch (e) {
			console.error("Error in clip audio iterator:", track.name, clip.name, e);
		}
	}

	async pause(): Promise<void> {
		this.playbackTimeAtStart = this.getPlaybackTime();
		this.isPlaying = false;

		// Clear any throttle interval (no longer used globally)

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
			if (this.masterGainNode) {
				trackState.gainNode.connect(this.masterGainNode);
			} else if (this.audioContext) {
				trackState.gainNode.connect(this.audioContext.destination);
			}
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
			const clipDurationSec = Math.max(0, clipTrimEndSec - clipTrimStartSec);
			const clipOneShotEndSec = clipStartSec + clipDurationSec;
			const now = this.getPlaybackTime();
			const loopUntilSec = clip.loop
				? clip.loopEnd
					? clip.loopEnd / 1000
					: Number.POSITIVE_INFINITY
				: clipOneShotEndSec;
			if (now >= loopUntilSec) continue;

			let cycleOffsetSec = 0;
			let timeIntoClip = 0;
			if (clip.loop) {
				if (now <= clipStartSec) {
					timeIntoClip = 0;
					cycleOffsetSec = 0;
				} else {
					const elapsed = now - clipStartSec;
					const cycleIndex =
						clipDurationSec > 0 ? Math.floor(elapsed / clipDurationSec) : 0;
					cycleOffsetSec = cycleIndex * clipDurationSec;
					timeIntoClip = clipDurationSec > 0 ? elapsed - cycleOffsetSec : 0;
				}
			} else {
				timeIntoClip = Math.max(0, now - clipStartSec);
			}
			const audioFileReadStart = clipTrimStartSec + timeIntoClip;
			if (audioFileReadStart >= clipTrimEndSec) continue;

			let cps = trackState.clipStates.get(clip.id);
			if (!cps) {
				cps = {
					iterator: null,
					gainNode: this.audioContext.createGain(),
					audioSources: [],
				};
				if (cps.gainNode && trackState.gainNode) {
					cps.gainNode.connect(trackState.gainNode);
				} else if (cps.gainNode) {
					(cps.gainNode as GainNode).connect(
						this.masterGainNode ?? this.audioContext.destination,
					);
				}
				trackState.clipStates.set(clip.id, cps);
			}

			// Reapply fades
			try {
				const clipGain = cps.gainNode ?? this.masterGainNode;
				if (!clipGain || !this.audioContext) return;
				const nowAC = this.audioContext.currentTime;
				clipGain.gain.cancelScheduledValues(nowAC);
				clipGain.gain.setValueAtTime(clipGain.gain.value ?? 1, nowAC);
				const clipStartAC =
					this.startTime + clipStartSec - this.playbackTimeAtStart;
				const oneShotEndAC =
					this.startTime + clipOneShotEndSec - this.playbackTimeAtStart;
				const loopEndAC =
					this.startTime + loopUntilSec - this.playbackTimeAtStart;
				if (clip.fadeIn && clip.fadeIn > 0) {
					const fadeInStart = Math.max(nowAC, clipStartAC);
					clipGain.gain.setValueAtTime(0, fadeInStart);
					clipGain.gain.linearRampToValueAtTime(
						1,
						fadeInStart + clip.fadeIn / 1000,
					);
				}
				if (clip.fadeOut && clip.fadeOut > 0) {
					if (clip.loop) {
						if (Number.isFinite(loopUntilSec)) {
							const end = Math.max(nowAC, loopEndAC);
							clipGain.gain.setValueAtTime(1, end - clip.fadeOut / 1000);
							clipGain.gain.linearRampToValueAtTime(0, end);
						}
					} else {
						const end = Math.max(nowAC, oneShotEndAC);
						clipGain.gain.setValueAtTime(1, end - clip.fadeOut / 1000);
						clipGain.gain.linearRampToValueAtTime(0, end);
					}
				}
			} catch {}

			cps.iterator = sink.buffers(audioFileReadStart, clipTrimEndSec);
			this.runClipAudioIterator(
				updatedTrack,
				clip,
				cps,
				clipStartSec,
				clipTrimStartSec,
				cycleOffsetSec,
				loopUntilSec,
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

	updateTrackMute(trackId: string, muted: boolean, volume?: number): void {
		const trackState = this.tracks.get(trackId);
		if (!trackState?.gainNode) return;
		const gn = trackState.gainNode;
		if (muted) {
			this.prevTrackVolumes.set(trackId, gn.gain.value);
			gn.gain.value = 0;
		} else {
			const prev = this.prevTrackVolumes.get(trackId);
			const target = typeof volume === "number" ? volume / 100 : (prev ?? 1);
			gn.gain.value = target;
			this.prevTrackVolumes.delete(trackId);
		}
	}

	updateMasterVolume(volume: number): void {
		if (this.masterGainNode) {
			this.masterGainNode.gain.value = volume / 100;
		}
	}

	async cleanup(): Promise<void> {
		try {
			await this.stop();
		} catch (e) {
			console.error("Error while stopping during cleanup", e);
		}
		this.tracks.clear();
		this.prevTrackVolumes.clear();
		if (this.audioContext) {
			try {
				await this.audioContext.close();
			} catch (e) {
				console.error("Error closing audio context", e);
			}
			this.audioContext = null;
			this.masterGainNode = null;
		}
	}
}

export const playbackEngine = PlaybackEngine.getInstance();
