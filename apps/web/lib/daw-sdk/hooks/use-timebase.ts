"use client";
import { useAtom } from "jotai"
import { gridAtom, musicalMetadataAtom } from "@/lib/daw-sdk"
import {
    barsBeatsToMs,
    formatBarsBeatsTicks,
    msToBarsBeats,
    msToBeats,
    snapTimeMs,
} from "@/lib/daw-sdk/utils/time-utils"

export function useTimebase() {
    const [grid, setGrid] = useAtom(gridAtom)
    const [music] = useAtom(musicalMetadataAtom)

    function snap(ms: number): number {
        return snapTimeMs(ms, grid, music.tempoBpm, music.timeSignature)
    }

    function format(ms: number): string {
        if (grid.mode === "time") return ms.toFixed(0) + " ms"
        return formatBarsBeatsTicks(ms, music.tempoBpm, music.timeSignature)
    }

    return {
        grid,
        setGrid,
        tempoBpm: music.tempoBpm,
        timeSignature: music.timeSignature,
        snap,
        format,
        msToBeats: (ms: number) => msToBeats(ms, music.tempoBpm, music.timeSignature),
        msToBarsBeats: (ms: number) => msToBarsBeats(ms, music.tempoBpm, music.timeSignature),
        barsBeatsToMs: (pos: { bar: number; beat: number; tick?: number }) =>
            barsBeatsToMs(pos, music.tempoBpm, music.timeSignature),
    }
}


