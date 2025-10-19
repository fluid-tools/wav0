export type PreviewPlayer = {
	load: (buffer: AudioBuffer) => void;
	play: () => void;
	pause: () => void;
	stop: () => void;
	isPlaying: () => boolean;
	currentTime: () => number;
	seek: (seconds: number) => void;
	setGain: (linear: number) => void;
	dispose: () => void;
	onended?: () => void;
};

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
		} catch {
			// ignore start errors from invalid offsets
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
			} catch {}
		};
	}

	function cleanupSource(): void {
		if (src) {
			try {
				src.stop();
			} catch {}
			try {
				src.disconnect();
			} catch {}
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
			if (gain) {
				const v = Math.max(0, Math.min(1, linear));
				gain.gain.setValueAtTime(v, (ac as AudioContext).currentTime);
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
				} catch {}
				try {
					ac.close();
				} catch {}
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
