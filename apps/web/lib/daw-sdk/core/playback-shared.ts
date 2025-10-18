import type { Clip, TrackEnvelope } from "@/lib/daw-sdk"
import { evaluateSegmentCurve } from "@/lib/daw-sdk/utils/curve-functions"

export function scheduleTrackEnvelope(
    ac: BaseAudioContext,
    param: AudioParam,
    envelope: TrackEnvelope | undefined,
    startSec: number,
): void {
    const now = (ac as AudioContext).currentTime ?? 0
    param.cancelScheduledValues(now)
    if (!envelope || !envelope.enabled) return
    // Simple anchor at current value; segments support can be added here
    const points = envelope.points || []
    if (points.length === 0) return
    // Assume points are absolute ms times
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]
        const b = points[i + 1]
        const segDur = Math.max(0.001, (b.time - a.time) / 1000)
        const segStart = startSec + a.time / 1000
        const curve = new Float32Array(64)
        for (let s = 0; s < curve.length; s++) {
            const t = s / (curve.length - 1)
            curve[s] = evaluateSegmentCurve(a.value, b.value, t, 0)
        }
        param.setValueCurveAtTime(curve, segStart, segDur)
    }
}

export async function scheduleClipNodes(
    ac: BaseAudioContext,
    clip: Clip,
    gainNode: GainNode,
    audioBuffer: AudioBuffer,
    absStartSec: number,
): Promise<void> {
    // Trim and schedule
    const trimStart = clip.trimStart / 1000
    const trimEnd = clip.trimEnd / 1000
    const duration = Math.max(0, trimEnd - trimStart)
    if (duration <= 0) return

    const src = (ac as AudioContext).createBufferSource()
    src.buffer = audioBuffer
    src.connect(gainNode)

    // Fades (basic linear; curve integration later)
    const now = (ac as AudioContext).currentTime ?? 0
    // For OfflineAudioContext, absStartSec is timeline 0-based; schedule from absStartSec
    const startT = Math.max(0, absStartSec)
    if (clip.fadeIn && clip.fadeIn > 0) {
        // Cancel any previous on this param from envelope scheduling overlapping this window
        gainNode.gain.cancelScheduledValues(startT)
        gainNode.gain.setValueAtTime(0, startT)
        gainNode.gain.linearRampToValueAtTime(1, startT + clip.fadeIn / 1000)
    }
    if (clip.fadeOut && clip.fadeOut > 0) {
        const fadeOutStart = Math.max(0, startT + duration - clip.fadeOut / 1000)
        gainNode.gain.cancelScheduledValues(fadeOutStart)
        gainNode.gain.setValueAtTime(1, fadeOutStart)
        gainNode.gain.linearRampToValueAtTime(0, startT + duration)
    }

    src.start(startT, trimStart, duration)
}


