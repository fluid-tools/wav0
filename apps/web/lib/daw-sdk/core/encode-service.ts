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

export async function encode(
	wavBytes: Uint8Array,
	fmt: "wav" | "flac" | "m4a" | "ogg",
	onProgress?: (p: number) => void,
): Promise<Uint8Array> {
	if (fmt === "wav") return wavBytes;
	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(
			new Blob([wavBytes as BlobPart], { type: "audio/wav" }),
		),
	});
	const output = new Output({
		format: pickFormat(fmt),
		target: new BufferTarget(),
	});
	const conversion = await Conversion.init({ input, output });
	if (!conversion.isValid) throw new Error("Conversion not valid");
	conversion.onProgress = (p) => onProgress?.(p);
	await conversion.execute();
	const buffer = output.target.buffer;
	if (!buffer) throw new Error("Conversion failed");
	return new Uint8Array(buffer);
}

function pickFormat(fmt: "wav" | "flac" | "m4a" | "ogg") {
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
