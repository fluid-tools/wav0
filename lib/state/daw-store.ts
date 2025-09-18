"use client"

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants"

export type Track = {
  id: string
  name: string
  audioUrl?: string
  audioBuffer?: ArrayBuffer
  duration: number
  startTime: number
  trimStart: number
  trimEnd: number
  volume: number
  muted: boolean
  soloed: boolean
  color: string
}

export type PlaybackState = {
  isPlaying: boolean
  currentTime: number
  duration: number
  bpm: number
  looping: boolean
}

export type TimelineState = {
  zoom: number
  scrollPosition: number
  snapToGrid: boolean
  gridSize: number // in milliseconds
}

export type DAWState = {
  projectName: string
  tracks: Track[]
  playback: PlaybackState
  timeline: TimelineState
  selectedTrackId: string | null
}

// Base atoms
export const tracksAtom = atomWithStorage<Track[]>("daw-tracks", [])
export const playbackAtom = atom<PlaybackState>({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  bpm: 120,
  looping: false,
})

export const timelineAtom = atom<TimelineState>({
  zoom: 1,
  scrollPosition: 0,
  snapToGrid: true,
  gridSize: 1000, // 1 second
})

export const selectedTrackIdAtom = atom<string | null>(null)
export const projectNameAtom = atomWithStorage<string>("daw-project-name", "Untitled Project")

// Derived atoms
export const selectedTrackAtom = atom((get) => {
  const tracks = get(tracksAtom)
  const selectedId = get(selectedTrackIdAtom)
  return tracks.find(track => track.id === selectedId) || null
})

export const totalDurationAtom = atom((get) => {
  const tracks = get(tracksAtom)
  const tracksDuration = Math.max(...tracks.map(track => track.startTime + track.duration), 0)
  const minimumDuration = 60 * 1000 // 60 seconds in ms
  return Math.max(tracksDuration, minimumDuration)
})

export const timelineWidthAtom = atom((get) => {
  const durationMs = get(totalDurationAtom)
  const zoom = get(timelineAtom).zoom
  const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom) / 1000
  const durationPx = durationMs * pxPerMs
  const paddingPx = DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom * 10 // 10s visual buffer (zoom-aware)
  return durationPx + paddingPx
})

export const projectEndPositionAtom = atom((get) => {
  const durationMs = get(totalDurationAtom)
  const zoom = get(timelineAtom).zoom
  const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom) / 1000
  return durationMs * pxPerMs
})

// Action atoms
export const addTrackAtom = atom(null, (get, set, track: Omit<Track, "id">) => {
  const tracks = get(tracksAtom)
  const newTrack: Track = {
    ...track,
    id: crypto.randomUUID(),
  }
  set(tracksAtom, [...tracks, newTrack])
  return newTrack.id
})

export const removeTrackAtom = atom(null, (get, set, trackId: string) => {
  const tracks = get(tracksAtom)
  set(tracksAtom, tracks.filter(track => track.id !== trackId))
  
  const selectedId = get(selectedTrackIdAtom)
  if (selectedId === trackId) {
    set(selectedTrackIdAtom, null)
  }
})

export const updateTrackAtom = atom(null, (get, set, trackId: string, updates: Partial<Track>) => {
  const tracks = get(tracksAtom)
  set(tracksAtom, tracks.map(track => 
    track.id === trackId ? { ...track, ...updates } : track
  ))
})

export const togglePlaybackAtom = atom(null, (get, set) => {
  const playback = get(playbackAtom)
  set(playbackAtom, { ...playback, isPlaying: !playback.isPlaying })
})

export const setCurrentTimeAtom = atom(null, (get, set, time: number) => {
  const playback = get(playbackAtom)
  set(playbackAtom, { ...playback, currentTime: time })
})

export const setTimelineZoomAtom = atom(null, (get, set, zoom: number) => {
  const timeline = get(timelineAtom)
  set(timelineAtom, { ...timeline, zoom })
})

export const setTimelineScrollAtom = atom(null, (get, set, scrollPosition: number) => {
  const timeline = get(timelineAtom)
  set(timelineAtom, { ...timeline, scrollPosition })
})

// Scroll position atoms for unified scroll management
export const horizontalScrollAtom = atom<number>(0)
export const verticalScrollAtom = atom<number>(0)

// Mutator for BPM (used by controls)
export const setBpmAtom = atom(null, (get, set, bpm: number) => {
  const playback = get(playbackAtom)
  const clamped = Math.max(30, Math.min(300, Number.isFinite(bpm) ? bpm : 120))
  set(playbackAtom, { ...playback, bpm: clamped })
})
