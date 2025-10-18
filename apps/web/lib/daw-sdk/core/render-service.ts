import type { Track } from "@/lib/daw-sdk"
import { audioService } from "@/lib/daw-sdk/core/audio-service"
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
    const endMs = Math.max(startMs + 1, opts.endMs ?? Math.max(...tracks.map(t => t.duration), 60000))
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
            const buf = await audioService.getAudioBuffer(clip.opfsFileId, clip.audioFileName ?? clip.name ?? "")
            if (!buf) continue
            const absStartSec = clip.startTime / 1000 - startMs / 1000
            if (absStartSec + (clip.trimEnd - clip.trimStart) / 1000 < 0) continue
            // Create per-clip gain to isolate fades from track envelope automation
            const clipGain = ac.createGain()
            clipGain.gain.value = 1
            clipGain.connect(trackGain)
            await scheduleClipNodes(ac as unknown as AudioContext, clip, clipGain, buf, Math.max(0, absStartSec))
        }
    }

    const rendered = await ac.startRendering()
    if (opts.normalize) {
        normalizeBuffer(rendered)
    }
    return rendered
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


