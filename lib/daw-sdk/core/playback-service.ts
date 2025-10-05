"use client"

import { z } from "zod"
import type { Clip, Track, PlaybackOptions } from "../types/schemas"
import { audioService } from "./audio-service"
import { evaluateCurve } from "../utils/curve-functions"

type ClipPlaybackState = {
	iterator: AsyncIterableIterator<{
		buffer: AudioBuffer
		timestamp: number
	}> | null
	gainNode: GainNode | null
	audioSources: AudioBufferSourceNode[]
	generation: number
}

type TrackPlaybackState = {
	clipStates: Map<string, ClipPlaybackState>
	envelopeGainNode: GainNode | null
	muteSoloGainNode: GainNode | null
	isPlaying: boolean
}

/**
 * PlaybackService - Core audio playback engine with MediaBunny
 * 
 * Architecture:
 * - Singleton pattern for global playback state
 * - Per-clip iterator-based scheduling for multi-clip tracks
 * - Dual gain chain: envelope automation + mute/solo control
 * - Time-accurate scheduling with AudioContext
 * 
 * Gain Chain: clipGain → envelopeGain → muteSoloGain → master
 */
export class PlaybackService {
	private static instance: PlaybackService
	private audioContext: AudioContext | null = null
	private masterGainNode: GainNode | null = null
	private tracks = new Map<string, TrackPlaybackState>()
	private isPlaying = false
	private startTime = 0
	private playbackTimeAtStart = 0
	private options: PlaybackOptions = {}
	private animationFrameId: number | null = null
	private queuedAudioNodes = new Set<AudioBufferSourceNode>()
	private nodeStartTimes = new WeakMap<AudioBufferSourceNode, number>()
	private trackMuteState = new Map<string, boolean>()
	private currentTracks = new Map<string, Track>()

	private constructor() {}

	static getInstance(): PlaybackService {
		if (!PlaybackService.instance) {
			PlaybackService.instance = new PlaybackService()
		}
		return PlaybackService.instance
	}

	private async getAudioContext(): Promise<AudioContext> {
		if (!this.audioContext) {
			this.audioContext = await audioService.getAudioContext()
			this.masterGainNode = this.audioContext.createGain()
			this.masterGainNode.connect(this.audioContext.destination)
		}
		return this.audioContext
	}

	private getPlaybackTime(): number {
		if (this.isPlaying && this.audioContext) {
			return (
				this.audioContext.currentTime -
				this.startTime +
				this.playbackTimeAtStart
			)
		}
		return this.playbackTimeAtStart
	}

	private async stopClipState(
		trackId: string,
		clipId: string,
	): Promise<ClipPlaybackState | null> {
		const trackState = this.tracks.get(trackId)
		if (!trackState) return null
		const clipState = trackState.clipStates.get(clipId)
		if (!clipState) return null

		try {
			if (clipState.iterator?.return) {
				await clipState.iterator.return()
			}
		} catch (error) {
			console.warn("Failed to close clip iterator", trackId, clipId, error)
		}
		clipState.iterator = null
		clipState.generation = (clipState.generation ?? 0) + 1

		for (const node of clipState.audioSources) {
			try {
				node.stop()
			} catch (error) {
				console.warn("Failed to stop clip source", trackId, clipId, error)
			}
		}
		clipState.audioSources = []
		clipState.gainNode?.disconnect?.()
		trackState.clipStates.delete(clipId)
		return clipState
	}

	async stopClip(trackId: string, clipId: string): Promise<void> {
		await this.stopClipState(trackId, clipId)
	}

	private cancelGainAutomation(gain: AudioParam, atTime: number): void {
		gain.cancelScheduledValues(atTime)
		gain.setValueAtTime(gain.value, atTime)
	}

	/**
	 * Schedule track volume envelope automation
	 * Applies curve-based gain scheduling to envelopeGainNode
	 */
	private scheduleTrackEnvelope(track: Track): void {
		if (!this.audioContext || !this.masterGainNode) return
		const state = this.tracks.get(track.id)
		if (!state?.envelopeGainNode) return
		const envelope = track.volumeEnvelope
		const envelopeGain = state.envelopeGainNode
		const now = this.audioContext.currentTime
		this.cancelGainAutomation(envelopeGain.gain, now)

		const baseVolume = track.volume / 100

		if (!envelope || !envelope.enabled || envelope.points.length === 0) {
			envelopeGain.gain.setValueAtTime(baseVolume, now)
			return
		}

		const sorted = [...envelope.points].sort((a, b) => a.time - b.time)
		const playbackStartMs = this.playbackTimeAtStart * 1000

		let currentMultiplier = 1.0
		for (const point of sorted) {
			if (point.time <= playbackStartMs) currentMultiplier = point.value
			else break
		}

		const currentGain = baseVolume * currentMultiplier
		envelopeGain.gain.setValueAtTime(currentGain, now)

		const futurePoints = sorted.filter(
			(point) => point.time >= playbackStartMs,
		)
		if (futurePoints.length === 0) return

		let lastMultiplier = currentMultiplier
		let lastTime = playbackStartMs
		let cumulativeACTime = now

		for (const point of futurePoints) {
			const segmentStart = Math.max(lastTime, playbackStartMs)
			const segmentEnd = point.time
			if (segmentEnd <= segmentStart) {
				lastTime = point.time
				lastMultiplier = point.value
				continue
			}

			const durationSec = (segmentEnd - segmentStart) / 1000
			if (durationSec < 0.001) {
				lastTime = point.time
				lastMultiplier = point.value
				continue
			}

			const steps = Math.max(2, Math.ceil(durationSec * 60))
			const values = new Float32Array(steps)

			const previousPoint =
				sorted.find((p) => p.time === lastTime) ?? sorted[0]
			const curveType = previousPoint?.curve ?? "linear"
			const curveShape = previousPoint?.curveShape ?? 0.5

			for (let i = 0; i < steps; i++) {
				const t = i / (steps - 1)
				const curveValue = evaluateCurve(curveType, t, curveShape)
				const multiplier =
					lastMultiplier + (point.value - lastMultiplier) * curveValue
				values[i] = baseVolume * multiplier
			}

			envelopeGain.gain.setValueCurveAtTime(
				values,
				cumulativeACTime,
				durationSec,
			)

			cumulativeACTime += durationSec
			lastTime = point.time
			lastMultiplier = point.value
		}
	}

	private applySnapshot(tracks: Track[]): void {
		if (!this.audioContext || !this.masterGainNode) return
		const soloEngaged = tracks.some((track) => track.soloed)
		for (const track of tracks) {
			const state = this.tracks.get(track.id)
			if (!state) continue

			if (!state.envelopeGainNode) {
				state.envelopeGainNode = this.audioContext.createGain()
			}
			if (!state.muteSoloGainNode) {
				state.muteSoloGainNode = this.audioContext.createGain()
				state.envelopeGainNode.connect(state.muteSoloGainNode)
				state.muteSoloGainNode.connect(this.masterGainNode)
			}

			const muted = Boolean(track.muted) || (soloEngaged && !track.soloed)
			this.trackMuteState.set(track.id, muted)
			state.muteSoloGainNode.gain.value = muted ? 0 : 1
			this.scheduleTrackEnvelope(track)
			state.isPlaying = !muted
		}
		this.currentTracks = new Map(tracks.map((track) => [track.id, track]))
	}

	private refreshMix(): void {
		if (this.currentTracks.size === 0) return
		const tracks = Array.from(this.currentTracks.values())
		this.applySnapshot(tracks)
	}

	synchronizeTracks(tracks: Track[]): void {
		this.applySnapshot(tracks)
	}

	async initializeWithTracks(tracks: Track[]): Promise<void> {
		await this.getAudioContext()
		this.tracks.clear()

		for (const track of tracks) {
			const hasClipRef = (track.clips ?? []).some((c) => !!c.opfsFileId)
			const hasLegacyRef = !!track.opfsFileId
			if (hasClipRef || hasLegacyRef) {
				this.tracks.set(track.id, {
					clipStates: new Map(),
					envelopeGainNode: null,
					muteSoloGainNode: null,
					isPlaying: false,
				})
			}
		}
	}

	async play(tracks: Track[], options: PlaybackOptions = {}): Promise<void> {
		// Validate options (callbacks are optional and not validated)
		const { startTime } = options
		if (startTime !== undefined) {
			z.number().min(0).parse(startTime)
		}
		this.options = options

		if (this.isPlaying) {
			await this.pause()
		}

		await this.getAudioContext()
		if (!this.audioContext || !this.masterGainNode) {
			throw new Error("AudioContext not initialized")
		}

		this.playbackTimeAtStart = options.startTime || 0
		this.startTime = this.audioContext.currentTime
		this.isPlaying = true

		this.applySnapshot(tracks)

		for (const track of tracks) {
			const trackState = this.tracks.get(track.id)
			if (!trackState) continue

			if (!trackState.envelopeGainNode) {
				trackState.envelopeGainNode = this.audioContext.createGain()
			}
			if (!trackState.muteSoloGainNode) {
				trackState.muteSoloGainNode = this.audioContext.createGain()
				trackState.envelopeGainNode.connect(trackState.muteSoloGainNode)
				trackState.muteSoloGainNode.connect(this.masterGainNode)
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
									sourceDurationMs: track.duration,
								} as Clip,
							]
						: []

			for (const clip of clips) {
				if (!clip.opfsFileId) continue
				await this.scheduleClip(track, clip, trackState)
			}
		}

		this.startTimeUpdateLoop()
	}

	private async scheduleClip(
		track: Track,
		clip: Clip,
		trackState: TrackPlaybackState,
	): Promise<void> {
		if (!this.audioContext || !this.masterGainNode) return

		let sink = audioService.getAudioBufferSink(clip.opfsFileId)
		if (!sink) {
			try {
				await audioService.loadTrackFromOPFS(
					clip.opfsFileId,
					clip.audioFileName ?? clip.name ?? "",
				)
				sink = audioService.getAudioBufferSink(clip.opfsFileId)
			} catch {}
		}
		if (!sink) return

		const clipStartSec = clip.startTime / 1000
		const clipTrimStartSec = clip.trimStart / 1000
		const clipTrimEndSec = clip.trimEnd / 1000
		const clipDurationSec = Math.max(0, clipTrimEndSec - clipTrimStartSec)
		const clipOneShotEndSec = clipStartSec + clipDurationSec
		const loopUntilSec = clip.loop
			? clip.loopEnd
				? clip.loopEnd / 1000
				: Number.POSITIVE_INFINITY
			: clipOneShotEndSec

		if (this.playbackTimeAtStart >= loopUntilSec) return

		let cycleOffsetSec = 0
		let timeIntoClip = 0
		if (clip.loop) {
			if (this.playbackTimeAtStart <= clipStartSec) {
				timeIntoClip = 0
				cycleOffsetSec = 0
			} else {
				const elapsed = this.playbackTimeAtStart - clipStartSec
				const cycleIndex =
					clipDurationSec > 0 ? Math.floor(elapsed / clipDurationSec) : 0
				cycleOffsetSec = cycleIndex * clipDurationSec
				timeIntoClip = clipDurationSec > 0 ? elapsed - cycleOffsetSec : 0
			}
		} else {
			timeIntoClip = Math.max(0, this.playbackTimeAtStart - clipStartSec)
		}

		const audioFileReadStart = clipTrimStartSec + timeIntoClip
		if (audioFileReadStart >= clipTrimEndSec) return

		let cps = trackState.clipStates.get(clip.id)
		if (!cps) {
			cps = {
				iterator: null,
				gainNode: this.audioContext.createGain(),
				audioSources: [],
				generation: 0,
			}
			if (cps.gainNode && trackState.envelopeGainNode) {
				cps.gainNode.connect(trackState.envelopeGainNode)
			}
			trackState.clipStates.set(clip.id, cps)
		}

		// Apply fade envelopes
		try {
			const clipGain = cps.gainNode ?? this.masterGainNode
			if (!clipGain || !this.audioContext) return
			const now = this.audioContext.currentTime
			this.cancelGainAutomation(clipGain.gain, now)
			const clipStartAC =
				this.startTime + clipStartSec - this.playbackTimeAtStart
			const loopEndAC =
				this.startTime + loopUntilSec - this.playbackTimeAtStart
			const oneShotEndAC =
				this.startTime + clipOneShotEndSec - this.playbackTimeAtStart

			if (clip.fadeIn && clip.fadeIn > 0) {
				clipGain.gain.setValueAtTime(0, Math.max(now, clipStartAC))
				clipGain.gain.linearRampToValueAtTime(
					1,
					Math.max(now, clipStartAC + clip.fadeIn / 1000),
				)
			}

			if (clip.fadeOut && clip.fadeOut > 0) {
				const targetEnd = clip.loop
					? Number.isFinite(loopUntilSec)
						? loopEndAC
						: null
					: oneShotEndAC
				if (targetEnd !== null) {
					clipGain.gain.setValueAtTime(
						1,
						Math.max(now, targetEnd - clip.fadeOut / 1000),
					)
					clipGain.gain.linearRampToValueAtTime(0, Math.max(now, targetEnd))
				}
			}
		} catch (e) {
			console.warn("Failed to schedule clip fades", e)
		}

		cps.generation = (cps.generation ?? 0) + 1
		cps.iterator = sink.buffers(audioFileReadStart, clipTrimEndSec)
		this.runClipAudioIterator(
			track,
			clip,
			cps,
			clipStartSec,
			clipTrimStartSec,
			cycleOffsetSec,
			loopUntilSec,
		)
	}

	private async runClipAudioIterator(
		track: Track,
		clip: Clip,
		cps: ClipPlaybackState,
		clipStartSec: number,
		clipTrimStartSec: number,
		cycleOffsetSec = 0,
		loopUntilSec = Number.POSITIVE_INFINITY,
	): Promise<void> {
		const myGen = cps.generation ?? 0
		if (!cps.iterator || !this.audioContext) return
		const clipGain = cps.gainNode
		const clipTrimEndSec = clip.trimEnd / 1000
		const clipDurationSec = clipTrimEndSec - clipTrimStartSec

		try {
			for await (const { buffer, timestamp } of cps.iterator) {
				if (!this.isPlaying || myGen !== (cps.generation ?? 0)) break

				const node = this.audioContext.createBufferSource()
				node.buffer = buffer
				node.connect(
					clipGain ?? this.masterGainNode ?? this.audioContext.destination,
				)

				const timeInTrimmed = timestamp - clipTrimStartSec
				const timelinePos = clipStartSec + cycleOffsetSec + timeInTrimmed
				if (timelinePos > loopUntilSec) break

				const startAt = this.startTime + timelinePos - this.playbackTimeAtStart

				if (startAt >= this.audioContext.currentTime) {
					node.start(startAt)
					this.nodeStartTimes.set(node, startAt)
				} else {
					const offset = this.audioContext.currentTime - startAt
					if (offset < buffer.duration) {
						const actualStart = this.audioContext.currentTime
						node.start(actualStart, offset)
						this.nodeStartTimes.set(node, actualStart)
					} else {
						continue
					}
				}

				cps.audioSources.push(node)
				this.queuedAudioNodes.add(node)
				node.onended = () => {
					const idx = cps.audioSources.indexOf(node)
					if (idx > -1) cps.audioSources.splice(idx, 1)
					this.queuedAudioNodes.delete(node)
					this.nodeStartTimes.delete(node)
				}

				const currentTimeline = this.getPlaybackTime()
				if (timelinePos - currentTimeline >= 0.25) {
					await new Promise<void>((resolve) => {
						const id = setInterval(() => {
							if (
								timelinePos - this.getPlaybackTime() < 0.25 ||
								!this.isPlaying ||
								myGen !== (cps.generation ?? 0)
							) {
								clearInterval(id)
								resolve()
							}
						}, 25)
					})
				}
			}

			// Handle loop continuation
			if (this.isPlaying && clip.loop && myGen === (cps.generation ?? 0)) {
				const sink = clip.opfsFileId
					? audioService.getAudioBufferSink(clip.opfsFileId)
					: null
				if (sink) {
					const nextCycleStart =
						cycleOffsetSec + clipDurationSec + clipStartSec
					if (nextCycleStart < loopUntilSec) {
						cps.generation = (cps.generation ?? 0) + 1
						cps.iterator = sink.buffers(clipTrimStartSec, clipTrimEndSec)
						this.runClipAudioIterator(
							track,
							clip,
							cps,
							clipStartSec,
							clipTrimStartSec,
							cycleOffsetSec + clipDurationSec,
							loopUntilSec,
						)
					}
				}
			}
		} catch (e) {
			console.error("Error in clip audio iterator:", track.name, clip.name, e)
		}
	}

	async pause(): Promise<void> {
		this.playbackTimeAtStart = this.getPlaybackTime()
		this.isPlaying = false

		for (const trackState of this.tracks.values()) {
			trackState.isPlaying = false
			for (const cps of trackState.clipStates.values()) {
				try {
					if (cps.iterator?.return) {
						await cps.iterator.return()
					}
				} catch {}
				cps.iterator = null
				cps.generation = (cps.generation ?? 0) + 1
				for (const node of [...cps.audioSources]) {
					try {
						node.stop()
					} catch {}
				}
				cps.audioSources = []
			}
		}

		for (const node of this.queuedAudioNodes) {
			try {
				node.stop()
			} catch {}
		}
		this.queuedAudioNodes.clear()
		this.stopTimeUpdateLoop()
	}

	async stop(): Promise<void> {
		await this.pause()
		this.playbackTimeAtStart = 0
		this.options.onTimeUpdate?.(0)
	}

	async rescheduleTrack(updatedTrack: Track): Promise<void> {
		if (!this.isPlaying) return
		await this.getAudioContext()
		if (!this.audioContext) return

		let trackState = this.tracks.get(updatedTrack.id)
		if (!trackState) {
			trackState = {
				clipStates: new Map(),
				envelopeGainNode: null,
				muteSoloGainNode: null,
				isPlaying: true,
			}
			this.tracks.set(updatedTrack.id, trackState)
		}

		for (const [clipId] of trackState.clipStates) {
			await this.stopClipState(updatedTrack.id, clipId)
		}

		if (!trackState.envelopeGainNode) {
			trackState.envelopeGainNode = this.audioContext.createGain()
		}
		if (!trackState.muteSoloGainNode) {
			trackState.muteSoloGainNode = this.audioContext.createGain()
			trackState.envelopeGainNode.connect(trackState.muteSoloGainNode)
			if (this.masterGainNode) {
				trackState.muteSoloGainNode.connect(this.masterGainNode)
			} else if (this.audioContext) {
				trackState.muteSoloGainNode.connect(this.audioContext.destination)
			}
		}

		trackState.isPlaying = true

		const clips =
			updatedTrack.clips && updatedTrack.clips.length > 0
				? updatedTrack.clips
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
								sourceDurationMs: updatedTrack.duration,
							} as Clip,
						]
					: []

		for (const clip of clips) {
			if (!clip.opfsFileId) continue
			await this.scheduleClip(updatedTrack, clip, trackState)
		}
	}

	getCurrentTime(): number {
		return this.getPlaybackTime()
	}

	getIsPlaying(): boolean {
		return this.isPlaying
	}

	private startTimeUpdateLoop(): void {
		const updateTime = () => {
			if (!this.isPlaying) return
			const currentTime = this.getPlaybackTime()
			this.options.onTimeUpdate?.(currentTime)
			this.animationFrameId = requestAnimationFrame(updateTime)
		}
		updateTime()
	}

	private stopTimeUpdateLoop(): void {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId)
			this.animationFrameId = null
		}
	}

	updateTrackVolume(_trackId: string, _volume: number): void {
		this.refreshMix()
	}

	updateTrackMute(_trackId: string, _muted: boolean, _volume?: number): void {
		this.refreshMix()
	}

	updateSoloStates(tracks: Track[]): void {
		this.applySnapshot(tracks)
	}

	updateMasterVolume(volume: number): void {
		if (this.masterGainNode) {
			this.masterGainNode.gain.value = volume / 100
		}
	}

	async cleanup(): Promise<void> {
		try {
			await this.stop()
		} catch (e) {
			console.error("Error while stopping during cleanup", e)
		}
		this.tracks.clear()
		this.currentTracks.clear()
		if (this.audioContext) {
			try {
				await this.audioContext.close()
			} catch (e) {
				console.error("Error closing audio context", e)
			}
			this.audioContext = null
			this.masterGainNode = null
		}
	}
}

export const playbackService = PlaybackService.getInstance()
