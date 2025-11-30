/**
 * Audio Encoding Utilities
 *
 * Converts WAV audio to various output formats using MediaBunny.
 */

import {
	ALL_FORMATS,
	BlobSource,
	BufferTarget,
	Conversion,
	FlacOutputFormat,
	Input,
	Mp4OutputFormat,
	Output,
	WavOutputFormat,
	WebMOutputFormat,
} from "mediabunny";

export type AudioFormat = "wav" | "flac" | "m4a" | "ogg";

/**
 * Encode WAV audio to a different format
 *
 * @param wavBytes - Input WAV audio data
 * @param format - Target format (wav, flac, m4a, ogg)
 * @param onProgress - Optional progress callback (0-1)
 * @returns Encoded audio data
 */
export async function encode(
	wavBytes: Uint8Array,
	format: AudioFormat,
	onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
	// WAV pass-through
	if (format === "wav") return wavBytes;

	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(
			new Blob([wavBytes as BlobPart], { type: "audio/wav" }),
		),
	});

	const output = new Output({
		format: pickFormat(format),
		target: new BufferTarget(),
	});

	const conversion = await Conversion.init({ input, output });
	if (!conversion.isValid) {
		throw new Error("Conversion not valid");
	}

	conversion.onProgress = (p: number) => onProgress?.(p);
	await conversion.execute();

	const buffer = output.target.buffer;
	if (!buffer) {
		throw new Error("Conversion failed");
	}

	return new Uint8Array(buffer);
}

/**
 * Get MIME type for audio format
 */
export function getMimeType(format: AudioFormat): string {
	switch (format) {
		case "wav":
			return "audio/wav";
		case "flac":
			return "audio/flac";
		case "m4a":
			return "audio/mp4";
		case "ogg":
			return "audio/ogg";
	}
}

/**
 * Get file extension for audio format
 */
export function getFileExtension(format: AudioFormat): string {
	return format;
}

function pickFormat(fmt: AudioFormat) {
	switch (fmt) {
		case "wav":
			return new WavOutputFormat();
		case "flac":
			return new FlacOutputFormat();
		case "m4a":
			return new Mp4OutputFormat();
		case "ogg":
			return new WebMOutputFormat();
	}
}

