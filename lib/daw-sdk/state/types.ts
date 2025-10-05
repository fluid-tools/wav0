/**
 * DAW SDK State Types
 * Source of truth for state-level type exports and helpers
 */

export type {
  Clip,
  Track,
  TrackEnvelope,
  TrackEnvelopePoint,
  PlaybackState,
  TimelineState,
  TimelineSection,
  Tool,
  AutomationType,
  ClipInspectorTarget,
} from "../types/schemas"

import type {
  TrackEnvelope,
  TrackEnvelopePoint,
  PlaybackState,
  TimelineState,
  Track,
} from "../types/schemas"

export type DAWState = {
  projectName: string
  tracks: Track[]
  playback: PlaybackState
  timeline: TimelineState
  selectedTrackId: string | null
}

export const ENVELOPE_GAIN_MIN = 0
export const ENVELOPE_GAIN_MAX = 4

export function clampEnvelopeGain(value: number): number {
  return Math.min(ENVELOPE_GAIN_MAX, Math.max(ENVELOPE_GAIN_MIN, value))
}

export function createDefaultEnvelope(_volume: number): TrackEnvelope {
  const defaultPoint: TrackEnvelopePoint = {
    id: crypto.randomUUID(),
    time: 0,
    value: 1,
    curve: "linear",
    curveShape: 0.5,
  }

  return {
    enabled: false,
    points: [defaultPoint],
  }
}
