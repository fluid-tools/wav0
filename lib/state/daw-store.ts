"use client"

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

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
  return Math.max(...tracks.map(track => track.startTime + track.duration), 0)
})

export const timelineWidthAtom = atom((get) => {
  const duration = get(totalDurationAtom)
  const zoom = get(timelineAtom).zoom
  return Math.max(duration * zoom * 0.1, 800) // 0.1px per ms at zoom 1
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

export const setBpmAtom = atom(null, (get, set, bpm: number) => {
  const playback = get(playbackAtom)
  set(playbackAtom, { ...playback, bpm })
})
