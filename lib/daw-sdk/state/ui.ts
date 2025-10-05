"use client"

import { atom } from "jotai"
import {
  selectedTrackIdAtom,
  selectedClipIdAtom,
  clipInspectorOpenAtom,
  clipInspectorTargetAtom,
  eventListOpenAtom,
  activeToolAtom,
  automationViewEnabledAtom,
  trackHeightZoomAtom,
  trackAutomationTypeAtom,
  projectNameAtom,
} from "./atoms"
import type { AutomationType, Tool } from "./types"

export const setSelectedTrackAtom = atom(
  null,
  (_get, set, trackId: string | null) => {
    set(selectedTrackIdAtom, trackId)
  },
)

export const setSelectedClipAtom = atom(
  null,
  (_get, set, clipId: string | null) => {
    set(selectedClipIdAtom, clipId)
  },
)

export const setClipInspectorOpenAtom = atom(
  null,
  (_get, set, open: boolean) => {
    set(clipInspectorOpenAtom, open)
  },
)

export const setClipInspectorTargetAtom = atom(
  null,
  (_get, set, target: { trackId: string; clipId: string } | null) => {
    set(clipInspectorTargetAtom, target)
  },
)

export const setEventListOpenAtom = atom(
  null,
  (_get, set, open: boolean) => {
    set(eventListOpenAtom, open)
  },
)

export const setActiveToolAtom = atom(
  null,
  (_get, set, tool: Tool) => {
    set(activeToolAtom, tool)
  },
)

export const toggleAutomationViewAtom = atom(null, (get, set) => {
  const current = get(automationViewEnabledAtom)
  set(automationViewEnabledAtom, !current)
})

export const setTrackHeightZoomAtom = atom(
  null,
  (_get, set, zoom: number) => {
    set(trackHeightZoomAtom, Math.max(0.6, Math.min(2.0, zoom)))
  },
)

export const setTrackAutomationTypeAtom = atom(
  null,
  (get, set, trackId: string, type: AutomationType) => {
    const current = new Map(get(trackAutomationTypeAtom))
    current.set(trackId, type)
    set(trackAutomationTypeAtom, current)
  },
)

export const setProjectNameAtom = atom(
  null,
  (_get, set, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set(projectNameAtom, trimmed)
  },
)
