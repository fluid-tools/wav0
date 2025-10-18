import type { Track } from "@/lib/daw-sdk"
import { scheduleClipNodes, scheduleTrackEnvelope } from "@/lib/daw-sdk/core/playback-shared"

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
    const endMs = Math.max(startMs + 1, opts.endMs ?? Math.max(...tracks.map(t => t.duration)))
    const sampleRate = opts.sampleRate ?? 48000
    const channels = opts.channels ?? 2
    const length = Math.ceil(((endMs - startMs) / 1000) * sampleRate)

    const ac = new OfflineAudioContext(channels, length, sampleRate)
    const master = ac.createGain()
    master.connect(ac.destination)

    for (const track of tracks) {
        const trackGain = ac.createGain()
        trackGain.connect(master)
        scheduleTrackEnvelope(ac, trackGain.gain, track.volumeEnvelope, 0)
        const clips = track.clips || []
        for (const clip of clips) {
            if (!clip.opfsFileId) continue
            // For now assume audioService has decoded buffer available globally; otherwise skip
            // @ts-expect-error placeholder global
            const buf: AudioBuffer | undefined = globalThis.__wav0_getAudioBuffer?.(clip.opfsFileId)
            if (!buf) continue
            const absStartSec = clip.startTime / 1000 - startMs / 1000
            if (absStartSec + (clip.trimEnd - clip.trimStart) / 1000 < 0) continue
            await scheduleClipNodes(ac as unknown as AudioContext, clip, trackGain, buf, Math.max(0, absStartSec))
        }
    }

    const rendered = await ac.startRendering()
    // TODO normalize/dither if requested
    return rendered
}


