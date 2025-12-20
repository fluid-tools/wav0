/**
 * Recording Service for WAV0 DAW SDK
 *
 * Handles microphone access and audio recording:
 * - Request microphone permissions
 * - Start/stop recording
 * - Convert recordings to AudioBuffer
 * - Monitor input levels
 */

// ============================================================================
// Types
// ============================================================================

export interface RecordingConfig {
	/** Sample rate for recording (default: 48000) */
	sampleRate: number;
	/** Number of channels (default: 1 = mono) */
	channels: number;
	/** Echo cancellation (default: true) */
	echoCancellation: boolean;
	/** Noise suppression (default: true) */
	noiseSuppression: boolean;
	/** Auto gain control (default: true) */
	autoGainControl: boolean;
}

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
	sampleRate: 48000,
	channels: 1,
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
};

export interface RecordingEventMap {
	"recording:start": undefined;
	"recording:stop": { buffer: AudioBuffer; duration: number };
	"recording:error": { error: Error };
	"level:update": { level: number };
}

// ============================================================================
// RecordingService Class
// ============================================================================

export class RecordingService extends EventTarget {
	private audioContext: AudioContext;
	private config: RecordingConfig;

	private mediaStream: MediaStream | null = null;
	private mediaRecorder: MediaRecorder | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private analyserNode: AnalyserNode | null = null;

	private chunks: Blob[] = [];
	private _isRecording = false;
	private levelAnimationFrame: number | null = null;

	constructor(audioContext: AudioContext, config?: Partial<RecordingConfig>) {
		super();
		this.audioContext = audioContext;
		this.config = { ...DEFAULT_RECORDING_CONFIG, ...config };
	}

	// ===========================================================================
	// Microphone Access
	// ===========================================================================

	/**
	 * Request microphone access from the user
	 * @returns Promise that resolves when access is granted
	 */
	async requestMicAccess(): Promise<void> {
		try {
			const constraints: MediaStreamConstraints = {
				audio: {
					sampleRate: this.config.sampleRate,
					channelCount: this.config.channels,
					echoCancellation: this.config.echoCancellation,
					noiseSuppression: this.config.noiseSuppression,
					autoGainControl: this.config.autoGainControl,
				},
			};

			this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

			// Create audio nodes for level monitoring
			this.sourceNode = this.audioContext.createMediaStreamSource(
				this.mediaStream,
			);
			this.analyserNode = this.audioContext.createAnalyser();
			this.analyserNode.fftSize = 256;
			this.sourceNode.connect(this.analyserNode);
			// Don't connect to destination to avoid feedback
		} catch (error) {
			const err =
				error instanceof Error
					? error
					: new Error("Failed to access microphone");
			this.emit("recording:error", { error: err });
			throw err;
		}
	}

	/**
	 * Check if microphone access has been granted
	 */
	hasMicAccess(): boolean {
		return this.mediaStream !== null;
	}

	/**
	 * Release microphone access
	 */
	releaseMicAccess(): void {
		if (this.mediaStream) {
			for (const track of this.mediaStream.getTracks()) {
				track.stop();
			}
			this.mediaStream = null;
		}

		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}

		if (this.analyserNode) {
			this.analyserNode.disconnect();
			this.analyserNode = null;
		}

		this.stopLevelMonitoring();
	}

	// ===========================================================================
	// Recording
	// ===========================================================================

	/**
	 * Start recording
	 * @throws Error if microphone access not granted
	 */
	startRecording(): void {
		if (!this.mediaStream) {
			throw new Error(
				"Microphone access not granted. Call requestMicAccess() first.",
			);
		}

		if (this._isRecording) {
			return;
		}

		this.chunks = [];

		// Create MediaRecorder
		const mimeType = this.getSupportedMimeType();
		this.mediaRecorder = new MediaRecorder(this.mediaStream, {
			mimeType,
		});

		this.mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				this.chunks.push(event.data);
			}
		};

		this.mediaRecorder.onerror = (event) => {
			this.emit("recording:error", {
				error: new Error(`Recording error: ${event}`),
			});
		};

		this.mediaRecorder.start(100); // Collect data every 100ms
		this._isRecording = true;

		this.startLevelMonitoring();
		this.emit("recording:start", undefined);
	}

	/**
	 * Stop recording and return the recorded AudioBuffer
	 * @returns Promise that resolves with the recorded AudioBuffer
	 */
	async stopRecording(): Promise<AudioBuffer> {
		if (!this.mediaRecorder || !this._isRecording) {
			throw new Error("Not currently recording");
		}

		return new Promise<AudioBuffer>((resolve, reject) => {
			if (!this.mediaRecorder) {
				reject(new Error("MediaRecorder not available"));
				return;
			}

			this.mediaRecorder.onstop = async () => {
				try {
					const audioBuffer = await this.processChunks();
					this.emit("recording:stop", {
						buffer: audioBuffer,
						duration: audioBuffer.duration,
					});
					resolve(audioBuffer);
				} catch (error) {
					const err =
						error instanceof Error
							? error
							: new Error("Failed to process recording");
					this.emit("recording:error", { error: err });
					reject(err);
				}
			};

			this.mediaRecorder.stop();
			this._isRecording = false;
			this.stopLevelMonitoring();
		});
	}

	/**
	 * Check if currently recording
	 */
	isRecording(): boolean {
		return this._isRecording;
	}

	// ===========================================================================
	// Level Monitoring
	// ===========================================================================

	/**
	 * Get current input level (0-1)
	 */
	getInputLevel(): number {
		if (!this.analyserNode) return 0;

		const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
		this.analyserNode.getByteFrequencyData(dataArray);

		// Calculate RMS
		let sum = 0;
		for (let i = 0; i < dataArray.length; i++) {
			const normalized = dataArray[i] / 255;
			sum += normalized * normalized;
		}
		const rms = Math.sqrt(sum / dataArray.length);

		return Math.min(1, rms * 2); // Scale for better visibility
	}

	private startLevelMonitoring(): void {
		const updateLevel = () => {
			if (!this._isRecording) return;

			const level = this.getInputLevel();
			this.emit("level:update", { level });

			this.levelAnimationFrame = requestAnimationFrame(updateLevel);
		};

		updateLevel();
	}

	private stopLevelMonitoring(): void {
		if (this.levelAnimationFrame !== null) {
			cancelAnimationFrame(this.levelAnimationFrame);
			this.levelAnimationFrame = null;
		}
	}

	// ===========================================================================
	// Audio Processing
	// ===========================================================================

	private async processChunks(): Promise<AudioBuffer> {
		if (this.chunks.length === 0) {
			throw new Error("No audio data recorded");
		}

		const blob = new Blob(this.chunks, { type: this.chunks[0].type });
		const arrayBuffer = await blob.arrayBuffer();

		// Decode the audio data
		const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

		// Convert to mono if needed
		if (audioBuffer.numberOfChannels > 1 && this.config.channels === 1) {
			return this.convertToMono(audioBuffer);
		}

		return audioBuffer;
	}

	private convertToMono(buffer: AudioBuffer): AudioBuffer {
		const monoBuffer = this.audioContext.createBuffer(
			1,
			buffer.length,
			buffer.sampleRate,
		);
		const monoData = monoBuffer.getChannelData(0);
		const numChannels = buffer.numberOfChannels;

		// Average all channels
		for (let i = 0; i < buffer.length; i++) {
			let sum = 0;
			for (let channel = 0; channel < numChannels; channel++) {
				sum += buffer.getChannelData(channel)[i];
			}
			monoData[i] = sum / numChannels;
		}

		return monoBuffer;
	}

	private getSupportedMimeType(): string {
		const mimeTypes = [
			"audio/webm;codecs=opus",
			"audio/webm",
			"audio/ogg;codecs=opus",
			"audio/mp4",
		];

		for (const mimeType of mimeTypes) {
			if (MediaRecorder.isTypeSupported(mimeType)) {
				return mimeType;
			}
		}

		return ""; // Let the browser choose
	}

	// ===========================================================================
	// Event Helpers
	// ===========================================================================

	private emit<K extends keyof RecordingEventMap>(
		event: K,
		detail: RecordingEventMap[K],
	): void {
		this.dispatchEvent(new CustomEvent(event, { detail }));
	}

	// ===========================================================================
	// Disposal
	// ===========================================================================

	dispose(): void {
		if (this._isRecording) {
			this.mediaRecorder?.stop();
			this._isRecording = false;
		}

		this.releaseMicAccess();
		this.chunks = [];
	}
}
