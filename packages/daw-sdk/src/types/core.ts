/**
 * Core DAW SDK Types and Interfaces
 * Framework-agnostic type definitions for audio engine
 */

export interface DAWConfig {
	audioContext?: AudioContext;
	sampleRate?: number;
	bufferSize?: number;
}

export type TransportState = "stopped" | "playing" | "paused" | "recording";

export interface TransportEvent {
	type: "play" | "stop" | "pause" | "seek" | "loop";
	state: TransportState;
	currentTime: number;
	timestamp: number;
	position?: number;
}

export interface AudioData {
	id: string;
	duration: number;
	sampleRate: number;
	numberOfChannels: number;
}

export interface LoadedTrack {
	id: string;
	input: any; // MediaBunny Input
	sink: any; // MediaBunny AudioBufferSink
	audioTrack: any; // MediaBunny InputAudioTrack
	duration: number;
}
