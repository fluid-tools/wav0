import { atom } from "jotai"
import type { Atom } from "jotai"
import {
  tracksAtom,
  playbackAtom,
  selectedTrackIdAtom,
  projectEndOverrideAtom,
} from "./atoms"
import type { Track, TrackEnvelope, Clip } from "./types"
import { clampEnvelopeGain, createDefaultEnvelope } from "./types"
import { playbackService, audioService } from "../index"
import { generateTrackId } from "@/lib/storage/opfs"
import type { PlaybackState } from "./types"

export const addTrackAtom = atom(null, (get, set, track: Omit<Track, "id">) => {
  const tracks = get(tracksAtom)
  const newTrack: Track = {
    ...track,
    id: crypto.randomUUID(),
    volumeEnvelope: track.volumeEnvelope
      ? {
          ...track.volumeEnvelope,
          points: track.volumeEnvelope.points.map((point) => ({
            ...point,
            value: clampEnvelopeGain(point.value),
          })),
        }
      : createDefaultEnvelope(track.volume),
  }
  set(tracksAtom, [...tracks, newTrack])
  return newTrack.id
})

type SetAtom<T> = Atom<null>

export const removeTrackAtom = atom(null, (get, set, trackId: string) => {
  const tracks = get(tracksAtom)
  set(
    tracksAtom,
    tracks.filter((track) => track.id !== trackId),
  )

  const selectedId = get(selectedTrackIdAtom)
  if (selectedId === trackId) {
    set(selectedTrackIdAtom, null)
  }
})

export const updateTrackAtom = atom(
  null,
  async (get, set, trackId: string, updates: Partial<Track>) => {
    const tracks = get(tracksAtom)
    const playback = get(playbackAtom)
    const updatedTracks = tracks.map((track) => {
      if (track.id !== trackId) return track
      if (updates.volumeEnvelope?.points) {
        const normalizedEnvelope: TrackEnvelope = {
          ...track.volumeEnvelope,
          ...updates.volumeEnvelope,
          points: updates.volumeEnvelope.points
            .map((point) => ({
              ...point,
              value: clampEnvelopeGain(point.value),
            }))
            .sort((a, b) => a.time - b.time),
        }
        return { ...track, ...updates, volumeEnvelope: normalizedEnvelope }
      }
      return { ...track, ...updates }
    })
    set(tracksAtom, updatedTracks)

    const updatedTrack = updatedTracks.find((t) => t.id === trackId)
    if (!updatedTrack) return
    playbackService.synchronizeTracks(updatedTracks)

    if (typeof updates.volume === "number") {
      playbackService.updateTrackVolume(trackId, updates.volume)
    }
    if (typeof updates.muted === "boolean") {
      const vol =
        typeof updates.volume === "number" ? updates.volume : updatedTrack.volume
      playbackService.updateTrackMute(trackId, updates.muted, vol)
    }
    if (typeof updates.soloed === "boolean") {
      playbackService.updateSoloStates(updatedTracks)
    }

    if (
      playback.isPlaying &&
      (updates.startTime !== undefined ||
        updates.trimStart !== undefined ||
        updates.trimEnd !== undefined)
    ) {
      try {
        await playbackService.rescheduleTrack(updatedTrack)
      } catch (error) {
        console.error("Failed to reschedule track after update", trackId, error)
      }
    }
  },
)

export const renameTrackAtom = atom(
  null,
  async (_get, set, trackId: string, name: string) => {
    const safe = name.trim()
    if (!safe) return
    await set(updateTrackAtom, trackId, { name: safe })
  },
)

export const initializeAudioFromOPFSAtom = atom(null, async (get, _set) => {
  const tracks = get(tracksAtom)
  for (const track of tracks) {
    if (!track.opfsFileId || !track.audioFileName) continue
    try {
      await audioService.loadTrackFromOPFS(track.opfsFileId, track.audioFileName)
    } catch (error) {
      console.error("Failed to load track from OPFS:", track.name, error)
    }
  }
})

export const loadAudioFileAtom = atom(
  null,
  async (
    get,
    set,
    file: File,
    existingTrackId?: string,
    opts?: { startTimeMs?: number },
  ) => {
    const opfsFileId = generateTrackId()
    const audioInfo = await audioService.loadAudioFile(file, opfsFileId)

    if (existingTrackId) {
      const tracks = get(tracksAtom)
      const existingTrack = tracks.find((t) => t.id === existingTrackId)
      if (existingTrack) {
        const clipId = crypto.randomUUID()
        const clip: Clip = {
          id: clipId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          opfsFileId,
          audioFileName: audioInfo.fileName,
          audioFileType: audioInfo.fileType,
          startTime: opts?.startTimeMs ?? existingTrack.startTime,
          trimStart: 0,
          trimEnd: audioInfo.duration * 1000,
          sourceDurationMs: audioInfo.duration * 1000,
          color: existingTrack.color,
        }

        const updatedTrack: Track = {
          ...existingTrack,
          name: clip.name,
          duration: audioInfo.duration * 1000,
          trimStart: 0,
          trimEnd: audioInfo.duration * 1000,
          opfsFileId,
          audioFileName: audioInfo.fileName,
          audioFileType: audioInfo.fileType,
          clips: [...(existingTrack.clips ?? []), clip],
        }

        set(
          tracksAtom,
          tracks.map((t) => (t.id === existingTrackId ? updatedTrack : t)),
        )

        const playback = get(playbackAtom)
        if (playback.isPlaying) {
          try {
            await playbackService.rescheduleTrack(updatedTrack)
          } catch (error) {
            console.error(
              "Failed to reschedule after adding clip",
              existingTrackId,
              error,
            )
          }
        }

        return updatedTrack
      }
    }

    const newTrackId = generateTrackId()
    const clipId = crypto.randomUUID()
    const clip: Clip = {
      id: clipId,
      name: file.name.replace(/\.[^/.]+$/, ""),
      opfsFileId,
      audioFileName: audioInfo.fileName,
      audioFileType: audioInfo.fileType,
      startTime: opts?.startTimeMs ?? 0,
      trimStart: 0,
      trimEnd: audioInfo.duration * 1000,
      sourceDurationMs: audioInfo.duration * 1000,
      color: "#3b82f6",
    }
    const newTrack: Track = {
      id: newTrackId,
      name: clip.name,
      duration: audioInfo.duration * 1000,
      startTime: 0,
      trimStart: 0,
      trimEnd: audioInfo.duration * 1000,
      volume: 75,
      muted: false,
      soloed: false,
      color: "#3b82f6",
      opfsFileId,
      audioFileName: audioInfo.fileName,
      audioFileType: audioInfo.fileType,
      clips: [clip],
    }

    set(tracksAtom, [...get(tracksAtom), newTrack])

    const playback = get(playbackAtom)
    if (playback.isPlaying) {
      try {
        await playbackService.rescheduleTrack(newTrack)
      } catch (error) {
        console.error(
          "Failed to reschedule after creating track",
          newTrackId,
          error,
        )
      }
    }

    return newTrack
  },
)

export const selectedTrackAtom = atom((get) => {
  const tracks = get(tracksAtom)
  const selectedId = get(selectedTrackIdAtom)
  return tracks.find((track) => track.id === selectedId) || null
})

export const totalDurationAtom = atom((get) => {
  const tracks = get(tracksAtom)
  if (tracks.length === 0) return 0

  const override = get(projectEndOverrideAtom)

  const perTrackEnds = tracks.map((track) => {
    if (track.clips && track.clips.length > 0) {
      return Math.max(
        ...track.clips.map((clip) => {
          const oneShotEnd = clip.startTime + Math.max(0, clip.trimEnd - clip.trimStart)
          const loopEnd = clip.loop ? clip.loopEnd ?? oneShotEnd : oneShotEnd
          return loopEnd
        }),
        0,
      )
    }
    return track.startTime + track.duration
  })

  const tracksDuration = Math.max(...perTrackEnds, 0)
  const minimumDuration = 180_000

  if (override !== null) {
    return Math.max(override, tracksDuration)
  }

  return Math.max(tracksDuration, minimumDuration)
})
