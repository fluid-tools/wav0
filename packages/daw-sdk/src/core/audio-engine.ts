/**
 * AudioEngine - Core audio file management with MediaBunny
 *
 * Event-driven architecture:
 * - Emits 'trackloaded' when audio is loaded
 * - Zero persistence - React layer handles storage via events
 * - Pure MediaBunny operations
 */

import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type InputAudioTrack,
} from "mediabunny";
import type { AudioData } from "../types/core";

export interface LoadedTrack {
	id: string;
	input: Input;
	sink: AudioBufferSink;
	audioTrack: InputAudioTrack;
	duration: number;
}

export class AudioEngine extends EventTarget {
	private loadedTracks = new Map<string, LoadedTrack>();

	constructor(private audioContext: AudioContext) {
		super();
	}

	async loadAudio(file: File, id: string): Promise<AudioData> {
		const input = new Input({
			formats: ALL_FORMATS,
			source: new BlobSource(file),
		});

		const audioTrack = await input.getPrimaryAudioTrack();
		if (!audioTrack) throw new Error("No audio track found");

		const sink = new AudioBufferSink(audioTrack);
		const duration = await audioTrack.computeDuration();

		this.loadedTracks.set(id, {
			id,
			input,
			sink,
			audioTrack,
			duration,
		});

		// Emit event for persistence layer
		this.dispatchEvent(
			new CustomEvent("trackloaded", {
				detail: {
					id,
					fileName: file.name,
					size: file.size,
					duration,
					sampleRate: audioTrack.sampleRate,
				},
			}),
		);

		return {
			id,
			duration,
			sampleRate: audioTrack.sampleRate,
			numberOfChannels: audioTrack.numberOfChannels,
		};
	}

	async getBufferIterator(
		audioId: string,
		startTime: number = 0,
		endTime?: number,
	): Promise<
		AsyncIterableIterator<{ buffer: AudioBuffer; timestamp: number }>
	> {
		const track = this.loadedTracks.get(audioId);
		if (!track) throw new Error(`Audio ${audioId} not loaded`);

		return track.sink.buffers(startTime, endTime);
	}

	getTrack(audioId: string): LoadedTrack | undefined {
		return this.loadedTracks.get(audioId);
	}

	hasTrack(audioId: string): boolean {
		return this.loadedTracks.has(audioId);
	}

	dispose(): void {
		// MediaBunny resources are garbage collected
		this.loadedTracks.clear();
	}
}
