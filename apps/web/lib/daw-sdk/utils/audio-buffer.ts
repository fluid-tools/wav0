export type WavOptions = { bitDepth: 16 | 24; dither?: boolean }

export function audioBufferToWav(buffer: AudioBuffer, opts: WavOptions): Uint8Array {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const numFrames = buffer.length
    const bytesPerSample = opts.bitDepth === 24 ? 3 : 2
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = numFrames * blockAlign
    const headerSize = 44
    const totalSize = headerSize + dataSize

    const out = new Uint8Array(totalSize)
    const view = new DataView(out.buffer)

    // RIFF header
    writeAscii(out, 0, 'RIFF')
    view.setUint32(4, totalSize - 8, true)
    writeAscii(out, 8, 'WAVE')

    // fmt chunk
    writeAscii(out, 12, 'fmt ')
    view.setUint32(16, 16, true) // PCM
    view.setUint16(20, 1, true) // format PCM
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, opts.bitDepth, true)

    // data chunk
    writeAscii(out, 36, 'data')
    view.setUint32(40, dataSize, true)

    // Interleave
    const chans = Array.from({ length: numChannels }, (_, i) => buffer.getChannelData(i))
    let offset = headerSize
    const ditherAmp = opts.dither ? (opts.bitDepth === 16 ? 1 / 65536 : 1 / 16777216) : 0
    for (let i = 0; i < numFrames; i++) {
        for (let c = 0; c < numChannels; c++) {
            let sample = chans[c][i]
            if (opts.dither) sample += (Math.random() - Math.random()) * ditherAmp
            sample = Math.max(-1, Math.min(1, sample))
            if (bytesPerSample === 2) {
                const s = (sample * 32767) | 0
                view.setInt16(offset, s, true)
                offset += 2
            } else {
                const s = (sample * 8388607) | 0
                out[offset++] = s & 0xff
                out[offset++] = (s >> 8) & 0xff
                out[offset++] = (s >> 16) & 0xff
            }
        }
    }
    return out
}

function writeAscii(arr: Uint8Array, offset: number, text: string) {
    for (let i = 0; i < text.length; i++) arr[offset + i] = text.charCodeAt(i)
}


