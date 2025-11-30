/**
 * Preview Player
 *
 * Simple AudioBuffer playback utility for previewing rendered audio.
 * Supports play, pause, stop, seek, and gain control.
 */

export interface PreviewPlayer {
	/** Load an AudioBuffer for playback */
	load: (buffer: AudioBuffer) => void;
	/** Start or resume playback */
	play: () => void;
	/** Pause playback (preserves position) */
	pause: () => void;
	/** Stop playback (resets to beginning) */
	stop: () => void;
	/** Check if currently playing */
	isPlaying: () => boolean;
	/** Get current playback position in seconds */
	currentTime: () => number;
	/** Seek to a position in seconds */
	seek: (seconds: number) => void;
	/** Set gain (0-1 linear) */
	setGain: (linear: number) => void;
	/** Dispose player and release resources */
	dispose: () => void;
	/** Callback when playback ends naturally */
	onended?: () => void;
}

/**
 * Create a new preview player instance
 */
export function createPreviewPlayer(): PreviewPlayer {
	let ac: AudioContext | null = null;
	let gain: GainNode | null = null;
	let src: AudioBufferSourceNode | null = null;
	let buffer: AudioBuffer | null = null;
	let startedAt = 0; // ac.currentTime at which playback of the buffer started at offset 0
	let pausedAt = 0; // seconds offset into buffer when paused/stopped
	let playing = false;
	let externalOnEnded: (() => void) | undefined;

	function ensureContext(): AudioContext {
		if (!ac) {
			ac = new AudioContext();
			gain = ac.createGain();
			gain.connect(ac.destination);
			gain.gain.value = 1;
		}
		return ac;
	}

	function createSourceAndStart(offsetSec: number): void {
		if (!ac || !gain || !buffer) return;
		cleanupSource();
		src = ac.createBufferSource();
		src.buffer = buffer;
		src.connect(gain);
		const when = ac.currentTime + 0.02;
		try {
			src.start(when, Math.max(0, Math.min(offsetSec, buffer.duration)));
		} catch (e) {
			console.warn("PreviewPlayer: invalid offset, starting from 0", e);
			src.start(when);
		}
		startedAt = when - offsetSec;
		playing = true;
		src.onended = () => {
			// If onended fires naturally, mark not playing unless replaced
			if (src) {
				playing = false;
			}
			// notify external handler
			try {
				externalOnEnded?.();
			} catch {
				// Ignore callback errors
			}
		};
	}

	function cleanupSource(): void {
		if (src) {
			try {
				src.stop();
			} catch {
				// Ignore stop errors from already-stopped nodes
			}
			try {
				src.disconnect();
			} catch {
				// Ignore disconnect errors
			}
			src = null;
		}
	}

	return {
		load(b: AudioBuffer) {
			ensureContext();
			buffer = b;
			// Reset position on new buffer
			pausedAt = 0;
			playing = false;
			cleanupSource();
		},
		play() {
			ensureContext();
			if (!buffer) return;
			if (playing) return;
			// resume from pausedAt
			createSourceAndStart(pausedAt);
		},
		pause() {
			if (!ac || !buffer) return;
			if (!playing) return;
			pausedAt = Math.max(0, Math.min(buffer.duration, this.currentTime()));
			cleanupSource();
			playing = false;
		},
		stop() {
			if (!buffer) return;
			pausedAt = 0;
			cleanupSource();
			playing = false;
		},
		isPlaying() {
			return playing;
		},
		currentTime() {
			if (!ac || !buffer) return 0;
			if (!playing) return pausedAt;
			return Math.max(0, Math.min(buffer.duration, ac.currentTime - startedAt));
		},
		seek(seconds: number) {
			if (!buffer) return;
			const clamped = Math.max(0, Math.min(buffer.duration, seconds));
			pausedAt = clamped;
			if (playing) {
				createSourceAndStart(pausedAt);
			}
		},
		setGain(linear: number) {
			ensureContext();
			if (gain && ac) {
				const v = Math.max(0, Math.min(1, linear));
				gain.gain.setValueAtTime(v, ac.currentTime);
			}
		},
		dispose() {
			cleanupSource();
			playing = false;
			buffer = null;
			pausedAt = 0;
			if (ac) {
				try {
					gain?.disconnect();
				} catch {
					// Ignore disconnect errors
				}
				try {
					ac.close();
				} catch {
					// Ignore close errors
				}
				ac = null;
				gain = null;
			}
		},
		get onended() {
			return externalOnEnded;
		},
		set onended(fn: (() => void) | undefined) {
			externalOnEnded = fn;
		},
	};
}
