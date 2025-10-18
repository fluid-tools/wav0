import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { ProjectMarker, TimelineSection } from "./types"

export const markersAtom = atomWithStorage<ProjectMarker[]>("daw-project-markers", [])
export const sectionsAtom = atomWithStorage<TimelineSection[]>("daw-project-sections", [])

export const gridAtom = atomWithStorage(
	"daw-grid",
	{
		mode: "time" as "time" | "bars",
		resolution: "1/4" as "1/1" | "1/2" | "1/4" | "1/8" | "1/16" | "triplet" | "swing",
		projectLengthMs: 60000,
	},
)

export const musicalMetadataAtom = atomWithStorage(
	"daw-musical-metadata",
	{
		tempoBpm: 120,
		timeSignature: { num: 4 as 2 | 3 | 4 | 5 | 7, den: 4 as 2 | 4 | 8 },
		key: {
			tonic: "C" as
				| "C"
				| "Db"
				| "D"
				| "Eb"
				| "E"
				| "F"
				| "Gb"
				| "G"
				| "Ab"
				| "A"
				| "Bb"
				| "B",
			scale: "major" as "major" | "minor",
		},
	},
)

// Write atoms for markers CRUD
export const addMarkerAtom = atom(
	null,
	(get, set, marker: Omit<ProjectMarker, "id">) => {
		const current = get(markersAtom)
		set(markersAtom, [...current, { ...marker, id: crypto.randomUUID() }])
	},
)

export const updateMarkerAtom = atom(
	null,
	(get, set, id: string, updates: Partial<ProjectMarker>) => {
		const current = get(markersAtom)
		set(
			markersAtom,
			current.map((m) => (m.id === id ? { ...m, ...updates } : m)),
		)
	},
)

export const removeMarkerAtom = atom(null, (get, set, id: string) => {
	const current = get(markersAtom)
	set(markersAtom, current.filter((m) => m.id !== id))
})
