"use client"

import { atom } from "jotai"
import { tracksAtom, playbackAtom, selectedClipIdAtom } from "./atoms"
import { selectedTrackIdAtom } from "./atoms"
import type { Clip, Track } from "./types"
import { playbackService } from "../index"

export const updateClipAtom = atom(
  null,
  async (get, set, trackId: string, clipId: string, updates: Partial<Clip>) => {
    const tracks = get(tracksAtom)
    const playback = get(playbackAtom)

    const updatedTracks = tracks.map((track) => {
      if (track.id !== trackId || !track.clips) return track
      return {
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === clipId ? { ...clip, ...updates } : clip,
        ),
      }
    })

    set(tracksAtom, updatedTracks)

    const updatedTrack = updatedTracks.find((track) => track.id === trackId)
    if (!updatedTrack) return

    if (
      playback.isPlaying &&
      (updates.startTime !== undefined ||
        updates.trimStart !== undefined ||
        updates.trimEnd !== undefined ||
        updates.loop !== undefined ||
        updates.loopEnd !== undefined)
    ) {
      try {
        await playbackService.rescheduleTrack(updatedTrack)
      } catch (error) {
        console.error(
          "Failed to reschedule track after clip update",
          trackId,
          clipId,
          error,
        )
      }
    }
  },
)

export const renameClipAtom = atom(
  null,
  async (_get, set, trackId: string, clipId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    await set(updateClipAtom, trackId, clipId, { name: trimmed })
  },
)

export const removeClipAtom = atom(
  null,
  async (get, set, trackId: string, clipId: string) => {
    const tracks = get(tracksAtom)
    const playback = get(playbackAtom)
    const selectedClipId = get(selectedClipIdAtom)

    const updatedTracks = tracks.map((track) => {
      if (track.id !== trackId || !track.clips) return track
      return {
        ...track,
        clips: track.clips.filter((clip) => clip.id !== clipId),
      }
    })

    set(tracksAtom, updatedTracks)

    if (selectedClipId === clipId) {
      set(selectedClipIdAtom, null)
    }

    const updatedTrack = updatedTracks.find((track) => track.id === trackId)
    if (!updatedTrack) return

    if (playback.isPlaying) {
      try {
        const sourceTrack = tracks.find(
          (track) => track.id !== trackId && track.clips?.some((clip) => clip.id === clipId),
        )
        if (sourceTrack) {
          await playbackService.stopClip(sourceTrack.id, clipId)
        }
        await playbackService.rescheduleTrack(updatedTrack)
      } catch (error) {
        console.error(
          "Failed to reschedule track after clip removal",
          trackId,
          error,
        )
      }
    }
  },
)

export const splitClipAtPlayheadAtom = atom(null, async (get, set) => {
    const tracks = get(tracksAtom)
    const selectedTrackId = get(selectedTrackIdAtom)
    const selectedClipId = get(selectedClipIdAtom)
    const playback = get(playbackAtom)

    if (!selectedTrackId || !selectedClipId) return

    const track = tracks.find((t) => t.id === selectedTrackId)
    if (!track || !track.clips) return

    const clip = track.clips.find((c) => c.id === selectedClipId)
    if (!clip) return

    const splitTimeMs = playback.currentTime
    const clipStartMs = clip.startTime
    const clipEndMs = clip.startTime + (clip.trimEnd - clip.trimStart)

    if (splitTimeMs <= clipStartMs || splitTimeMs >= clipEndMs) return

    const offsetInClip = splitTimeMs - clip.startTime

    const newLeft: Clip = {
      ...clip,
      id: crypto.randomUUID(),
      trimEnd: clip.trimStart + offsetInClip,
    }

    const newRight: Clip = {
      ...clip,
      id: crypto.randomUUID(),
      startTime: splitTimeMs,
      trimStart: clip.trimStart + offsetInClip,
    }

    newLeft.fadeOut = newLeft.fadeOut ?? 15
    newRight.fadeIn = newRight.fadeIn ?? 15

    const updatedClips = track.clips.flatMap((c) =>
      c.id === clip.id ? [newLeft, newRight] : c,
    ) as Clip[]

    const updatedTrack: Track = { ...track, clips: updatedClips }
    const updatedTracks = tracks.map((t) =>
      t.id === track.id ? updatedTrack : t,
    )

    set(tracksAtom, updatedTracks)
    set(selectedClipIdAtom, newRight.id)

    if (playback.isPlaying) {
      try {
        await playbackService.rescheduleTrack(updatedTrack)
      } catch (error) {
        console.error("Failed to reschedule after split", track.id, error)
      }
    }
  })
