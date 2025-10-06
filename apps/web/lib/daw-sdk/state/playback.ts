"use client"

import { atom } from "jotai"
import { tracksAtom, playbackAtom } from "./atoms"
import { totalDurationAtom } from "./tracks"
import { playbackService } from "../index"
import type { Track } from "./types"

export const togglePlaybackAtom = atom(null, async (get, set) => {
  const tracks = get(tracksAtom) as Track[]
  const playback = get(playbackAtom)

  if (playback.isPlaying) {
    await playbackService.pause()
    set(playbackAtom, { ...playback, isPlaying: false })
    return
  }

  const currentTimeSeconds = playback.currentTime / 1000

  await playbackService.initializeWithTracks(tracks)

  await playbackService.play(tracks, {
    startTime: currentTimeSeconds,
    onTimeUpdate: (timeSeconds: number) => {
      const newPlayback = get(playbackAtom)
      const total = get(totalDurationAtom)
      const currentMs = timeSeconds * 1000
      if (currentMs >= total) {
        set(playbackAtom, { ...newPlayback, currentTime: 0, isPlaying: false })
        return
      }
      set(playbackAtom, { ...newPlayback, currentTime: currentMs })
    },
    onPlaybackEnd: () => {
      const endState = get(playbackAtom)
      set(playbackAtom, { ...endState, isPlaying: false })
    },
  })

  set(playbackAtom, { ...playback, isPlaying: true })
})

export const stopPlaybackAtom = atom(null, async (get, set) => {
  await playbackService.stop()
  const playback = get(playbackAtom)
  set(playbackAtom, { ...playback, isPlaying: false })
})

export const setCurrentTimeAtom = atom(null, async (get, set, timeMs: number) => {
  const playback = get(playbackAtom)
  const tracks = get(tracksAtom) as Track[]

  set(playbackAtom, { ...playback, currentTime: timeMs })

  if (!playback.isPlaying) return

  await playbackService.pause()

  await playbackService.play(tracks, {
    startTime: timeMs / 1000,
    onTimeUpdate: (currentTimeSeconds: number) => {
      const newState = get(playbackAtom)
      const total = get(totalDurationAtom)
      const ms = currentTimeSeconds * 1000
      if (ms >= total) {
        set(playbackAtom, { ...newState, currentTime: 0, isPlaying: false })
        return
      }
      set(playbackAtom, { ...newState, currentTime: ms })
    },
    onPlaybackEnd: () => {
      const endState = get(playbackAtom)
      set(playbackAtom, { ...endState, isPlaying: false })
    },
  })
})

export const setBpmAtom = atom(null, (get, set, bpm: number) => {
  const playback = get(playbackAtom)
  const clamped = Math.max(30, Math.min(300, Number.isFinite(bpm) ? bpm : 120))
  set(playbackAtom, { ...playback, bpm: clamped })
})

export const toggleLoopingAtom = atom(null, (get, set) => {
  const playback = get(playbackAtom)
  set(playbackAtom, { ...playback, looping: !playback.looping })
})
