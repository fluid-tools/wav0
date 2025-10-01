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
	generation: number; // increments to cancel stale schedulers
};

type TrackPlaybackState = {
	clipStates: Map<string, ClipPlaybackState>;
	envelopeGainNode: GainNode | null; // envelope automation (volume curve)
	muteSoloGainNode: GainNode | null; // mute/solo control (0 or 1)
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
	private nodeStartTimes = new WeakMap<AudioBufferSourceNode, number>();
	private trackMuteState = new Map<string, boolean>();
	private prevTrackVolumes = new Map<string, number>();
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: used by audio handler
	private lastSnapshot: Track[] = [];
	private currentTracks = new Map<string, Track>();

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

	// Safely cancel gain automation from a point in time
	private cancelGainAutomation(gain: AudioParam, atTime: number): void {
		const g = gain as AudioParam & {
			cancelAndHoldAtTime?: (time: number) => void;
		};
		if (typeof g.cancelAndHoldAtTime === "function") {
			g.cancelAndHoldAtTime(atTime);
		} else {
			gain.cancelScheduledValues(atTime);
			gain.setValueAtTime(gain.value, atTime);
		}
	}

	private scheduleTrackEnvelope(track: Track): void {
		if (!this.audioContext || !this.masterGainNode) return;
		const state = this.tracks.get(track.id);
		if (!state?.envelopeGainNode) return;
		const envelope = track.volumeEnvelope;
		const envelopeGain = state.envelopeGainNode;
		const now = this.audioContext.currentTime;
		this.cancelGainAutomation(envelopeGain.gain, now);

		// Base volume from track slider (0-1 range)
		const baseVolume = track.volume / 100;

		if (!envelope || !envelope.enabled || envelope.points.length === 0) {
			// No envelope: just use base volume
			envelopeGain.gain.setValueAtTime(baseVolume, now);
			return;
		}

		const sorted = [...envelope.points].sort((a, b) => a.time - b.time);
		const playbackStartMs = this.playbackTimeAtStart * 1000;

		// Find current multiplier based on playback position
		let currentMultiplier = 1.0; // Default to 100% of base
		for (const point of sorted) {
			if (point.time <= playbackStartMs) currentMultiplier = point.value;
			else break;
		}

		// Apply: base volume × envelope multiplier
		const currentGain = baseVolume * currentMultiplier;
		envelopeGain.gain.setValueAtTime(currentGain, now);

		const futurePoints = sorted.filter(
			(point) => point.time >= playbackStartMs,
		);
		let lastMultiplier = currentMultiplier;

		for (const point of futurePoints) {
			const offsetSec = (point.time - playbackStartMs) / 1000;
			if (offsetSec < 0) continue;
			const at = this.startTime + offsetSec;
			const multiplier = point.value;

			if (multiplier === lastMultiplier) continue;

			// Target gain = base volume × envelope multiplier
			const targetGain = baseVolume * multiplier;

			switch (point.curve) {
				case "easeIn":
					envelopeGain.gain.exponentialRampToValueAtTime(
						Math.max(targetGain, 0.0001), // Avoid 0 for exponential
						Math.max(at, now),
					);
					break;
				case "easeOut":
				case "sCurve":
				default:
					envelopeGain.gain.linearRampToValueAtTime(
						targetGain,
						Math.max(at, now),
					);
					break;
			}
			lastMultiplier = multiplier;
		}
	}

	private applySnapshot(tracks: Track[]): void {
		if (!this.audioContext || !this.masterGainNode) return;
		const soloEngaged = tracks.some((track) => track.soloed);
		for (const track of tracks) {
			const state = this.tracks.get(track.id);
			if (!state) continue;

			// Setup gain node chain: envelopeGain → muteSoloGain → master
			if (!state.envelopeGainNode) {
				state.envelopeGainNode = this.audioContext.createGain();
			}
			if (!state.muteSoloGainNode) {
				state.muteSoloGainNode = this.audioContext.createGain();
				state.envelopeGainNode.connect(state.muteSoloGainNode);
				state.muteSoloGainNode.connect(this.masterGainNode);
			}

			const muted = Boolean(track.muted) || (soloEngaged && !track.soloed);
			this.trackMuteState.set(track.id, muted);

			// Mute/solo is binary: 0 or 1
			state.muteSoloGainNode.gain.value = muted ? 0 : 1;

			// Envelope scheduling happens regardless of mute state
			this.scheduleTrackEnvelope(track);

			state.isPlaying = !muted;
		}
		this.lastSnapshot = tracks.map((track) => ({ ...track }));
		this.currentTracks = new Map(tracks.map((track) => [track.id, track]));
	}

	private refreshMix(): void {
		if (this.currentTracks.size === 0) return;
		const tracks = Array.from(this.currentTracks.values()).map((track) => ({
			...track,
		}));
		this.applySnapshot(tracks);
	}

	synchronizeTracks(tracks: Track[]): void {
		this.applySnapshot(tracks);
	}

	// Initialize track state if it has any loaded audio (clip or legacy)
	async initializeWithTracks(tracks: Track[]): Promise<void> {
		await this.getAudioContext();
		this.tracks.clear();

		for (const track of tracks) {
			// Create a playback state for any track that references audio,
			// even if the sink isn't loaded yet; we'll lazy-load during play
			const hasClipRef = (track.clips ?? []).some((c) => !!c.opfsFileId);
			const hasLegacyRef = !!track.opfsFileId;
			if (hasClipRef || hasLegacyRef) {
				this.tracks.set(track.id, {
					clipStates: new Map(),
					envelopeGainNode: null,
					muteSoloGainNode: null,
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

		this.applySnapshot(tracks);

		for (const track of tracks) {
			const trackState = this.tracks.get(track.id);
			if (!trackState) continue;

			// Setup gain chain if needed
			if (!trackState.envelopeGainNode) {
				trackState.envelopeGainNode = this.audioContext.createGain();
			}
			if (!trackState.muteSoloGainNode) {
				trackState.muteSoloGainNode = this.audioContext.createGain();
				trackState.envelopeGainNode.connect(trackState.muteSoloGainNode);
				trackState.muteSoloGainNode.connect(this.masterGainNode);
			}

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
				let sink = audioManager.getAudioBufferSink(clip.opfsFileId);
				if (!sink) {
					try {
						await audioManager.loadTrackFromOPFS(
							clip.opfsFileId,
							clip.audioFileName ?? clip.name ?? "",
						);
						sink = audioManager.getAudioBufferSink(clip.opfsFileId);
					} catch {}
				}
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
						generation: 0,
					};
					if (cps.gainNode && trackState.envelopeGainNode) {
						cps.gainNode.connect(trackState.envelopeGainNode);
					}
					trackState.clipStates.set(clip.id, cps);
				}

				// Configure clip fades (basic linear ramps) — apply to one-shot segment only
				try {
					const clipGain = cps.gainNode ?? this.masterGainNode;
					if (!clipGain || !this.audioContext) continue;
					const now = this.audioContext.currentTime;
					// Reset automation from 'now' to avoid stale ramps
					this.cancelGainAutomation(clipGain.gain, now);
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
				cps.generation = (cps.generation ?? 0) + 1;
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
		const myGen = cps.generation ?? 0;
		if (!cps.iterator || !this.audioContext) return;
		const clipGain = cps.gainNode;
		const clipTrimEndSec = clip.trimEnd / 1000;
		const clipDurationSec = clipTrimEndSec - clipTrimStartSec;
		try {
			for await (const { buffer, timestamp } of cps.iterator) {
				if (!this.isPlaying || myGen !== (cps.generation ?? 0)) break;
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
					this.nodeStartTimes.set(node, startAt);
				} else {
					const offset = this.audioContext.currentTime - startAt;
					if (offset < buffer.duration) {
						const actualStart = this.audioContext.currentTime;
						node.start(actualStart, offset);
						this.nodeStartTimes.set(node, actualStart);
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
					this.nodeStartTimes.delete(node);
				};

				// Short lookahead window (~250ms)
				const currentTimeline = this.getPlaybackTime();
				if (timelinePos - currentTimeline >= 0.25) {
					await new Promise((resolve) => {
						const id = setInterval(() => {
							if (
								timelinePos - this.getPlaybackTime() < 0.25 ||
								!this.isPlaying ||
								myGen !== (cps.generation ?? 0)
							) {
								clearInterval(id);
								resolve(undefined);
							}
						}, 25);
					});
				}
			}
			// If clip loops, restart iterator for the next cycle within loopUntilSec
			// Guard with generation to avoid stale schedulers spawning cycles
			if (this.isPlaying && clip.loop && myGen === (cps.generation ?? 0)) {
				const sink = clip.opfsFileId
					? audioManager.getAudioBufferSink(clip.opfsFileId)
					: null;
				if (sink) {
					const nextCycleStart =
						cycleOffsetSec + clipDurationSec + clipStartSec;
					if (nextCycleStart < loopUntilSec) {
						cps.generation = (cps.generation ?? 0) + 1;
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
				cps.generation = (cps.generation ?? 0) + 1;
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
			trackState = {
				clipStates: new Map(),
				envelopeGainNode: null,
				muteSoloGainNode: null,
				isPlaying: true,
			};
			this.tracks.set(updatedTrack.id, trackState);
		}

		// Stop all existing clip iterators/nodes
		trackState.isPlaying = false;
		for (const cps of trackState.clipStates.values()) {
			await cps.iterator?.return?.(undefined);
			cps.iterator = null;
			cps.generation = (cps.generation ?? 0) + 1; // invalidate any in-flight schedulers
			for (const node of [...cps.audioSources]) {
				try {
					node.stop();
				} catch {}
			}
			cps.audioSources = [];
		}

		// Ensure track gain chain exists
		if (!trackState.envelopeGainNode) {
			trackState.envelopeGainNode = this.audioContext.createGain();
		}
		if (!trackState.muteSoloGainNode) {
			trackState.muteSoloGainNode = this.audioContext.createGain();
			trackState.envelopeGainNode.connect(trackState.muteSoloGainNode);
			if (this.masterGainNode) {
				trackState.muteSoloGainNode.connect(this.masterGainNode);
			} else if (this.audioContext) {
				trackState.muteSoloGainNode.connect(this.audioContext.destination);
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
			let sink = audioManager.getAudioBufferSink(clip.opfsFileId);
			if (!sink) {
				await audioManager.loadTrackFromOPFS(
					clip.opfsFileId,
					clip.audioFileName ?? clip.name ?? "",
				);
				sink = audioManager.getAudioBufferSink(clip.opfsFileId);
			}
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
					generation: 0,
				};
				if (cps.gainNode && trackState.envelopeGainNode) {
					cps.gainNode.connect(trackState.envelopeGainNode);
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

			cps.generation = (cps.generation ?? 0) + 1;
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

	updateTrackVolume(_trackId: string, _volume: number): void {
		// Volume changes are reflected through refreshMix → scheduleTrackEnvelope
		this.refreshMix();
	}

	updateTrackMute(_trackId: string, _muted: boolean, _volume?: number): void {
		// Mute/unmute is handled through refreshMix → applySnapshot → muteSoloGainNode
		this.refreshMix();
	}

	updateSoloStates(tracks: Track[]): void {
		this.applySnapshot(tracks);
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
		this.trackMuteState.clear();
		this.currentTracks.clear();
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
