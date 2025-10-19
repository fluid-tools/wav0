import type { Track } from "@/lib/daw-sdk"
import { audioService } from "@/lib/daw-sdk/core/audio-service"
import { scheduleTrackEnvelopeInRange } from "@/lib/daw-sdk/core/playback-shared"

export type RenderOptions = {
    startMs?: number
    endMs?: number
    sampleRate?: number
    channels?: 1 | 2
    normalize?: boolean
    dither16?: boolean
}

export async function renderProjectToAudioBuffer(
    project: { tracks: Track[] },
    opts: RenderOptions = {},
): Promise<AudioBuffer> {
    const tracks = project.tracks || []
    const startMs = Math.max(0, opts.startMs ?? 0)
    const endMs = Math.max(
        startMs + 1,
        opts.endMs ?? computeProjectEndMs(tracks),
    )
    const sampleRate = opts.sampleRate ?? 48000
    const channels = opts.channels ?? 2
    const length = Math.ceil(((endMs - startMs) / 1000) * sampleRate)

    const ac = new OfflineAudioContext(channels, length, sampleRate)
    const master = ac.createGain()
    master.connect(ac.destination)

    for (const track of tracks) {
        const trackGain = ac.createGain()
        trackGain.connect(master)
        scheduleTrackEnvelopeInRange(
            ac,
            trackGain.gain,
            track.volumeEnvelope,
            startMs,
            endMs,
        )
        const clips = track.clips || []
        for (const clip of clips) {
            if (!clip.opfsFileId) continue
            const buffer = await audioService.getAudioBuffer(
                clip.opfsFileId,
                clip.audioFileName ?? clip.name ?? "",
            )
            if (!buffer) continue
            const clipGain = ac.createGain()
            clipGain.gain.value = 1
            clipGain.connect(trackGain)
            scheduleClipInRange(
                ac,
                clipGain,
                buffer,
                clip,
                startMs / 1000,
                endMs / 1000,
            )
        }
    }

    const rendered = await ac.startRendering()
    if (opts.normalize) {
        normalizeBuffer(rendered)
    }
    return rendered
}

function computeProjectEndMs(tracks: Track[]): number {
    let maxEnd = 0
    for (const t of tracks) {
        const clips = t.clips || []
        for (const c of clips) {
            const oneShotEnd = c.startTime + Math.max(0, c.trimEnd - c.trimStart)
            const loopEnd = c.loop ? (c.loopEnd ?? oneShotEnd) : oneShotEnd
            maxEnd = Math.max(maxEnd, loopEnd)
        }
    }
    return Math.max(maxEnd, 60000)
}

function scheduleClipInRange(
    ac: BaseAudioContext,
    clipGain: GainNode,
    buffer: AudioBuffer,
    clip: {
        startTime: number
        trimStart: number
        trimEnd: number
        loop?: boolean
        loopEnd?: number
        fadeIn?: number
        fadeOut?: number
    },
    rangeStartSec: number,
    rangeEndSec: number,
): void {
    const trimStartSec = (clip.trimStart ?? 0) / 1000
    const trimEndSec = (clip.trimEnd ?? 0) / 1000
    const clipDurSec = Math.max(1e-6, trimEndSec - trimStartSec)
    if (clipDurSec <= 0) return
    const clipAbsStartSec = (clip.startTime ?? 0) / 1000
    let audibleStart = Math.max(rangeStartSec, clipAbsStartSec)
    const absoluteLoopEnd = clip.loop
        ? (clip.loopEnd ? clip.loopEnd / 1000 : Number.POSITIVE_INFINITY)
        : clipAbsStartSec + clipDurSec
    const audibleEnd = Math.min(rangeEndSec, absoluteLoopEnd)
    if (audibleEnd <= audibleStart) return

    const scheduleTile = (
        tileStartSec: number,
        offsetSec: number,
        playDurSec: number,
        isFirst: boolean,
        isLast: boolean,
    ) => {
        const node = (ac as AudioContext).createBufferSource()
        node.buffer = buffer
        const tileGain = (ac as AudioContext).createGain()
        tileGain.gain.value = 1
        node.connect(tileGain)
        tileGain.connect(clipGain)

        // Fades at boundaries only
        if (isFirst && (clip.fadeIn || 0) > 0) {
            const fadeSec = (clip.fadeIn as number) / 1000
            tileGain.gain.cancelScheduledValues(tileStartSec)
            tileGain.gain.setValueAtTime(0, tileStartSec)
            tileGain.gain.linearRampToValueAtTime(1, tileStartSec + Math.min(fadeSec, playDurSec))
        }
        if (isLast && (clip.fadeOut || 0) > 0) {
            const fadeSec = (clip.fadeOut as number) / 1000
            const foStart = Math.max(tileStartSec, tileStartSec + playDurSec - fadeSec)
            tileGain.gain.cancelScheduledValues(foStart)
            tileGain.gain.setValueAtTime(1, foStart)
            tileGain.gain.linearRampToValueAtTime(0, tileStartSec + playDurSec)
        }

        node.start(tileStartSec, offsetSec, playDurSec)
    }

    // First tile (align to clip cycle when looping)
    let cycleOffset = 0
    if (clip.loop && audibleStart > clipAbsStartSec) {
        const delta = audibleStart - clipAbsStartSec
        cycleOffset = delta % clipDurSec
    }
    let offsetSec = trimStartSec + cycleOffset
    // If cycleOffset nearly equals clipDurSec, skip to next cycle to avoid tiny/negative duration
    if (cycleOffset > clipDurSec - 1e-6) {
        audibleStart += (clipDurSec - cycleOffset)
        cycleOffset = 0
        offsetSec = trimStartSec
    }
    let playDurSec = Math.min(
        clipDurSec - cycleOffset,
        audibleEnd - audibleStart,
    )
    if (playDurSec > 1e-6) {
        const isLastFirst = !clip.loop || audibleStart + playDurSec >= audibleEnd - 1e-6
        scheduleTile(audibleStart, offsetSec, playDurSec, true, isLastFirst)
    }

    if (!clip.loop) return

    // Remaining tiles
    let nextTileStart = audibleStart + Math.max(playDurSec, 0)
    while (nextTileStart < audibleEnd - 1e-6) {
        offsetSec = trimStartSec
        playDurSec = Math.min(clipDurSec, audibleEnd - nextTileStart)
        if (playDurSec <= 1e-6) break
        const isLast = nextTileStart + playDurSec >= audibleEnd - 1e-6
        scheduleTile(nextTileStart, offsetSec, playDurSec, false, isLast)
        nextTileStart += playDurSec
        if (clip.loopEnd && nextTileStart >= (clip.loopEnd / 1000)) break
    }
}

function normalizeBuffer(buffer: AudioBuffer): void {
    let peak = 0
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch)
        for (let i = 0; i < data.length; i++) {
            peak = Math.max(peak, Math.abs(data[i]))
        }
    }
    if (peak > 0 && peak < 1) {
        const scale = 0.95 / peak
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch)
            for (let i = 0; i < data.length; i++) {
                data[i] *= scale
            }
        }
    }
}


