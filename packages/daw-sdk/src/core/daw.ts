/**
 * DAW - Unified facade for audio engine
 *
 * Provides:
 * - Single entry point for all DAW operations
 * - Lifecycle management (initialization, disposal)
 * - AudioContext management
 */

import type { DAWConfig } from "../types/core";
import { AudioEngine } from "./audio-engine";
import { Transport } from "./transport";

export class DAW {
	private audioEngine: AudioEngine;
	private transport: Transport;
	private audioContext: AudioContext;

	constructor(config: DAWConfig = {}) {
		this.audioContext = config.audioContext || new AudioContext();
		this.audioEngine = new AudioEngine(this.audioContext);
		this.transport = new Transport(this.audioEngine, this.audioContext);
	}

	getAudioEngine(): AudioEngine {
		return this.audioEngine;
	}

	getTransport(): Transport {
		return this.transport;
	}

	getAudioContext(): AudioContext {
		return this.audioContext;
	}

	async resumeContext(): Promise<void> {
		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}
	}

	dispose(): void {
		this.transport.stop();
		this.audioEngine.dispose();
		if (this.audioContext.state !== "closed") {
			this.audioContext.close();
		}
	}
}

export function createDAW(config?: DAWConfig): DAW {
	return new DAW(config);
}
