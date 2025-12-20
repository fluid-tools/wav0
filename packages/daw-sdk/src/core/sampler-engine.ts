/**
 * Sampler Engine for WAV0 DAW SDK
 *
 * Trigger-based audio playback system with:
 * - Configurable pad count (default 16, max 64)
 * - Pitch shifting via playbackRate
 * - ADSR envelopes with curve support
 * - Voice management and polyphony (32 max, 4 default)
 * - Voice stealing (release → oldest → lowest velocity)
 * - Choke groups (hi-hat style)
 * - Output routing for DAW integration
 *
 * Bug fixes implemented:
 * - noteToVoice cleanup on voice steal (prevents wrong note release)
 * - Generation counter guards setTimeout callbacks (prevents state corruption)
 * - Envelope level estimation (accurate release from any ADSR phase)
 */

import type {
	SamplerConfig,
	SamplerEventMap,
	SamplerPad,
	Voice,
	VoiceStealingConfig,
} from "../types/sampler";
import {
	calculatePlaybackRate,
	createDefaultPad,
	DEFAULT_SAMPLER_CONFIG,
	DEFAULT_VOICE_STEALING,
} from "../types/sampler";
import { curves } from "../utils/curves";

// ============================================================================
// SamplerEngine Class
// ============================================================================

export class SamplerEngine extends EventTarget {
	private audioContext: AudioContext;
	private config: SamplerConfig;
	private voiceStealingConfig: VoiceStealingConfig;

	private pads: Map<string, SamplerPad> = new Map();
	private voices: Map<string, Voice> = new Map();
	private noteToVoice: Map<number, string> = new Map(); // For release tracking
	private toggledPads: Set<string> = new Set(); // For toggle play mode

	private outputGain: GainNode;
	private activeVoiceCount: number;
	private voiceIdCounter = 0;

	constructor(
		audioContext: AudioContext,
		config?: Partial<SamplerConfig>,
		voiceStealing?: Partial<VoiceStealingConfig>,
	) {
		super();
		this.audioContext = audioContext;
		this.config = { ...DEFAULT_SAMPLER_CONFIG, ...config };
		this.voiceStealingConfig = { ...DEFAULT_VOICE_STEALING, ...voiceStealing };
		this.activeVoiceCount = this.config.defaultVoices;

		// Create output stage
		this.outputGain = audioContext.createGain();
		this.outputGain.gain.value = 1;

		// Initialize pads
		this.initializePads();
	}

	// ===========================================================================
	// Initialization
	// ===========================================================================

	private initializePads(): void {
		for (let i = 0; i < this.config.padCount; i++) {
			const pad = createDefaultPad(i, this.config.baseNote);
			this.pads.set(pad.id, pad);
		}
	}

	// ===========================================================================
	// Pad Management
	// ===========================================================================

	getPad(padId: string): SamplerPad | undefined {
		return this.pads.get(padId);
	}

	getPadByNote(note: number): SamplerPad | undefined {
		for (const pad of this.pads.values()) {
			if (pad.triggerNote === note) return pad;
			if (pad.keyRange && note >= pad.keyRange[0] && note <= pad.keyRange[1]) {
				return pad;
			}
		}
		return undefined;
	}

	getPadByIndex(index: number): SamplerPad | undefined {
		return this.pads.get(`pad-${index}`);
	}

	getAllPads(): SamplerPad[] {
		return Array.from(this.pads.values());
	}

	updatePad(padId: string, updates: Partial<SamplerPad>): void {
		const pad = this.pads.get(padId);
		if (!pad) return;

		const updatedPad = { ...pad, ...updates };
		this.pads.set(padId, updatedPad);

		this.emit("pad:updated", { padId, changes: updates });
	}

	loadSample(padId: string, audioBuffer: AudioBuffer): void {
		const pad = this.pads.get(padId);
		if (!pad) throw new Error(`Pad not found: ${padId}`);

		this.pads.set(padId, {
			...pad,
			audioBuffer,
			sampleInfo: {
				fileName: "loaded",
				duration: audioBuffer.duration,
				sampleRate: audioBuffer.sampleRate,
				channels: audioBuffer.numberOfChannels,
			},
		});

		this.emit("pad:loaded", { padId, buffer: audioBuffer });
	}

	clearSample(padId: string): void {
		const pad = this.pads.get(padId);
		if (!pad) return;

		this.pads.set(padId, {
			...pad,
			audioBuffer: null,
			sampleInfo: undefined,
		});

		this.emit("pad:cleared", { padId });
	}

	// ===========================================================================
	// Voice Triggering
	// ===========================================================================

	triggerAttack(note: number, velocity: number): string | null {
		const pad = this.getPadByNote(note);
		if (!pad || !pad.audioBuffer || pad.muted) return null;

		// Check for solo (if any pad is soloed, only play soloed pads)
		const hasSolo = Array.from(this.pads.values()).some((p) => p.soloed);
		if (hasSolo && !pad.soloed) return null;

		// Handle toggle mode
		if (pad.playMode === "toggle") {
			if (this.toggledPads.has(pad.id)) {
				// Stop the toggled voice
				this.stopPadVoices(pad.id);
				this.toggledPads.delete(pad.id);
				return null;
			}
			this.toggledPads.add(pad.id);
		}

		// Handle choke groups
		this.handleChokeGroup(pad);

		// Get or steal a voice
		const voice = this.acquireVoice(pad, note, velocity);
		if (!voice) return null;

		// Create audio nodes
		this.setupVoiceNodes(voice, pad, velocity);

		// Apply ADSR attack
		this.applyAttack(voice, pad, velocity);

		// Start playback
		this.startVoicePlayback(voice, pad);

		// Track note for release
		this.noteToVoice.set(note, voice.id);

		this.emit("voice:start", {
			voiceId: voice.id,
			padId: pad.id,
			note,
			velocity,
		});

		return voice.id;
	}

	triggerRelease(note: number): void {
		const voiceId = this.noteToVoice.get(note);
		if (!voiceId) return;

		const voice = this.voices.get(voiceId);
		if (!voice || voice.state === "release" || voice.state === "finished")
			return;

		// FIX A/E: Verify the voice is still playing this note
		// (prevents releasing wrong voice after voice steal)
		if (voice.note !== note) {
			// Voice was stolen and is now playing a different note
			// Just clean up the stale mapping
			this.noteToVoice.delete(note);
			return;
		}

		const pad = this.pads.get(voice.padId);
		if (!pad) return;

		// One-shot ignores release
		if (pad.playMode === "one-shot") return;

		// Toggle mode ignores release (waits for next note-on)
		if (pad.playMode === "toggle") return;

		// Latch mode ignores release (plays until end)
		if (pad.playMode === "latch") return;

		// Apply release envelope
		this.applyRelease(voice, pad);

		this.noteToVoice.delete(note);

		this.emit("voice:release", {
			voiceId: voice.id,
			padId: pad.id,
			note,
		});
	}

	triggerAttackRelease(
		note: number,
		velocity: number,
		durationMs: number,
	): void {
		const voiceId = this.triggerAttack(note, velocity);
		if (!voiceId) return;

		const voice = this.voices.get(voiceId);
		if (!voice) return;

		// FIX C: Capture generation to guard the setTimeout
		const generation = voice.generation;

		setTimeout(() => {
			// Guard: only release if voice wasn't reused
			if (voice.generation !== generation) return;
			this.triggerRelease(note);
		}, durationMs);
	}

	// ===========================================================================
	// Voice Management
	// ===========================================================================

	private acquireVoice(
		pad: SamplerPad,
		note: number,
		velocity: number,
	): Voice | null {
		// Check pad-specific voice limit
		const padMaxVoices =
			pad.maxVoices > 0 ? pad.maxVoices : this.activeVoiceCount;
		const padVoices = this.getVoicesForPad(pad.id);
		if (padVoices.length >= padMaxVoices) {
			// Steal from this pad's voices
			const victim = this.selectVictim(padVoices, note);
			if (victim) {
				// FIX A/E: Clean up victim's note mapping before reuse
				this.cleanupNoteMapping(victim);
				this.quickFadeOut(victim);
				return this.initializeVoice(victim, pad, note, velocity);
			}
		}

		// Find idle or finished voice
		for (const voice of this.voices.values()) {
			if (voice.state === "idle" || voice.state === "finished") {
				return this.initializeVoice(voice, pad, note, velocity);
			}
		}

		// Need to create or steal
		if (this.voices.size < this.activeVoiceCount) {
			return this.createVoice(pad, note, velocity);
		}

		// Steal a voice
		return this.stealVoice(pad, note, velocity);
	}

	private createVoice(pad: SamplerPad, note: number, velocity: number): Voice {
		const voiceId = `voice-${this.voiceIdCounter++}`;
		const voice: Voice = {
			id: voiceId,
			padId: pad.id,
			note,
			velocity,
			state: "idle",
			startTime: 0,
			generation: 0,
			peakLevel: 0,
			sustainLevel: 0,
			sourceNode: null,
			gainNode: null,
			pannerNode: null,
		};
		this.voices.set(voiceId, voice);
		return this.initializeVoice(voice, pad, note, velocity);
	}

	private initializeVoice(
		voice: Voice,
		pad: SamplerPad,
		note: number,
		velocity: number,
	): Voice {
		// Cleanup any existing nodes
		this.cleanupVoiceNodes(voice);

		// FIX C: Increment generation to invalidate any pending timeouts
		voice.generation += 1;

		// Set voice properties
		voice.padId = pad.id;
		voice.note = note;
		voice.velocity = velocity;
		voice.state = "attack";
		voice.startTime = this.audioContext.currentTime;
		voice.releaseStartTime = undefined;
		voice.releaseLevelStart = undefined;

		// Calculate envelope levels for this trigger
		const velocityScale = velocity / 127;
		voice.peakLevel = velocityScale * pad.volume;
		voice.sustainLevel = voice.peakLevel * pad.envelope.sustain;

		return voice;
	}

	private stealVoice(
		pad: SamplerPad,
		note: number,
		velocity: number,
	): Voice | null {
		if (this.voiceStealingConfig.mode === "none") return null;

		const candidates = Array.from(this.voices.values()).filter(
			(v) => v.state !== "idle" && v.state !== "finished",
		);

		if (candidates.length === 0) return null;

		const victim = this.selectVictim(candidates, note);
		if (!victim) return null;

		// FIX A/E: Clean up victim's note mapping before reuse
		this.cleanupNoteMapping(victim);

		// Quick fade out
		this.quickFadeOut(victim);

		this.emit("voice:stolen", { voiceId: victim.id, stolenBy: `new-${note}` });

		return this.initializeVoice(victim, pad, note, velocity);
	}

	/**
	 * FIX A/E: Remove a voice's note from noteToVoice map.
	 * Called before voice is reused to prevent stale mappings.
	 */
	private cleanupNoteMapping(voice: Voice): void {
		for (const [mappedNote, voiceId] of this.noteToVoice.entries()) {
			if (voiceId === voice.id) {
				this.noteToVoice.delete(mappedNote);
				break; // Each voice maps to at most one note
			}
		}
	}

	private selectVictim(
		candidates: Voice[],
		incomingNote: number,
	): Voice | null {
		if (candidates.length === 0) return null;

		let victim: Voice | null = null;

		// Prefer releasing voices
		if (this.voiceStealingConfig.preferReleasing) {
			const releasing = candidates.filter((v) => v.state === "release");
			if (releasing.length > 0) {
				victim = releasing.reduce((oldest, v) =>
					v.startTime < oldest.startTime ? v : oldest,
				);
				return victim;
			}
		}

		// Apply stealing mode
		switch (this.voiceStealingConfig.mode) {
			case "oldest":
				victim = candidates.reduce((oldest, v) =>
					v.startTime < oldest.startTime ? v : oldest,
				);
				break;
			case "lowest-velocity":
				victim = candidates.reduce((quietest, v) =>
					v.velocity < quietest.velocity ? v : quietest,
				);
				break;
			case "same-note":
				victim = candidates.find((v) => v.note === incomingNote) || null;
				break;
		}

		return victim;
	}

	private getVoicesForPad(padId: string): Voice[] {
		return Array.from(this.voices.values()).filter(
			(v) => v.padId === padId && v.state !== "idle" && v.state !== "finished",
		);
	}

	// ===========================================================================
	// Audio Node Setup
	// ===========================================================================

	private setupVoiceNodes(
		voice: Voice,
		pad: SamplerPad,
		_velocity: number,
	): void {
		// Create audio nodes
		voice.sourceNode = this.audioContext.createBufferSource();
		voice.sourceNode.buffer = pad.audioBuffer;

		voice.gainNode = this.audioContext.createGain();
		voice.gainNode.gain.value = 0; // Start at 0 for attack

		voice.pannerNode = this.audioContext.createStereoPanner();
		voice.pannerNode.pan.value = pad.pan;

		// Connect: source → gain → panner → output
		voice.sourceNode.connect(voice.gainNode);
		voice.gainNode.connect(voice.pannerNode);
		voice.pannerNode.connect(this.outputGain);

		// Apply pitch shift
		const pitchRate = calculatePlaybackRate(pad.pitchShift, pad.fineTune);
		voice.sourceNode.playbackRate.value = pitchRate;

		// Handle loop
		if (pad.loop.enabled && pad.audioBuffer) {
			voice.sourceNode.loop = true;
			voice.sourceNode.loopStart = pad.loop.start * pad.audioBuffer.duration;
			voice.sourceNode.loopEnd = pad.loop.end * pad.audioBuffer.duration;
		}

		// Set up end handler
		voice.sourceNode.onended = () => {
			if (voice.state !== "finished") {
				voice.state = "finished";
				this.recycleVoice(voice);
				this.emit("voice:end", {
					voiceId: voice.id,
					padId: pad.id,
					note: voice.note,
				});
			}
		};
	}

	private startVoicePlayback(voice: Voice, pad: SamplerPad): void {
		if (!voice.sourceNode || !pad.audioBuffer) return;

		if (pad.reverse) {
			// For reverse playback, we need to start from the end
			// Note: This requires a pre-reversed buffer in practice
			// For MVP, we'll just play forward and note this as a TODO
			voice.sourceNode.start(0);
		} else {
			voice.sourceNode.start(0);
		}
	}

	// ===========================================================================
	// ADSR Envelope
	// ===========================================================================

	private applyAttack(voice: Voice, pad: SamplerPad, velocity: number): void {
		if (!voice.gainNode) return;

		const now = this.audioContext.currentTime;
		const velocityScale = velocity / 127;
		const peakLevel = velocityScale * pad.volume;
		const envelope = pad.envelope;

		// Store levels for envelope estimation (FIX B)
		voice.peakLevel = peakLevel;
		voice.sustainLevel = peakLevel * envelope.sustain;

		// Start at 0
		voice.gainNode.gain.setValueAtTime(0, now);

		// Attack: 0 → peak
		const attackDuration = envelope.attack / 1000;
		if (attackDuration > 0) {
			curves.applyCurveToParam(
				voice.gainNode.gain,
				0,
				peakLevel,
				now,
				attackDuration,
				envelope.attackCurve,
				this.audioContext,
			);
		} else {
			voice.gainNode.gain.setValueAtTime(peakLevel, now);
		}

		// Decay: peak → sustain
		const attackEnd = now + attackDuration;
		const sustainLevel = peakLevel * envelope.sustain;
		const decayDuration = envelope.decay / 1000;

		if (decayDuration > 0 && envelope.sustain < 1) {
			curves.applyCurveToParam(
				voice.gainNode.gain,
				peakLevel,
				sustainLevel,
				attackEnd,
				decayDuration,
				envelope.decayCurve,
				this.audioContext,
			);
		}

		// Update voice state based on envelope timing
		voice.state = "attack";

		// FIX C: Capture generation to guard setTimeout callbacks
		const generation = voice.generation;

		// Schedule state transitions
		if (attackDuration > 0) {
			setTimeout(() => {
				// Guard: only update if voice wasn't reused
				if (voice.generation !== generation) return;
				if (voice.state === "attack") {
					voice.state = decayDuration > 0 ? "decay" : "sustain";
				}
			}, attackDuration * 1000);
		}

		if (decayDuration > 0) {
			setTimeout(
				() => {
					// Guard: only update if voice wasn't reused
					if (voice.generation !== generation) return;
					if (voice.state === "decay") {
						voice.state = "sustain";
					}
				},
				(attackDuration + decayDuration) * 1000,
			);
		}
	}

	/**
	 * FIX B: Estimate the current envelope level based on ADSR phase and timing.
	 * Uses curve interpolation formulas inspired by fastidious-envelope-generator.
	 *
	 * For exponential curves: value = target + (start - target) * exp(-elapsed/timeConst)
	 * For linear curves: value = start + (end - start) * (elapsed / duration)
	 * For custom curves: uses applyCurvedT from curves utility
	 */
	private estimateEnvelopeLevel(voice: Voice, now: number): number {
		const pad = this.pads.get(voice.padId);
		if (!pad) return voice.sustainLevel;

		const elapsed = now - voice.startTime;
		const envelope = pad.envelope;
		const attackSec = envelope.attack / 1000;
		const decaySec = envelope.decay / 1000;

		// During release phase, use the stored release start level
		if (voice.state === "release" && voice.releaseLevelStart !== undefined) {
			if (voice.releaseStartTime === undefined) return 0;
			const releaseElapsed = now - voice.releaseStartTime;
			const releaseSec = envelope.release / 1000;
			if (releaseSec <= 0) return 0;

			const t = Math.min(1, releaseElapsed / releaseSec);
			return this.interpolateWithCurve(
				voice.releaseLevelStart,
				0,
				t,
				envelope.releaseCurve,
			);
		}

		// During attack phase
		if (elapsed < attackSec) {
			if (attackSec <= 0) return voice.peakLevel;
			const t = elapsed / attackSec;
			return this.interpolateWithCurve(
				0,
				voice.peakLevel,
				t,
				envelope.attackCurve,
			);
		}

		// During decay phase
		if (elapsed < attackSec + decaySec) {
			if (decaySec <= 0) return voice.sustainLevel;
			const t = (elapsed - attackSec) / decaySec;
			return this.interpolateWithCurve(
				voice.peakLevel,
				voice.sustainLevel,
				t,
				envelope.decayCurve,
			);
		}

		// Sustain phase
		return voice.sustainLevel;
	}

	/**
	 * Interpolate between two values using a curve parameter.
	 * Curve: -99 to +99 (0 = linear, negative = exponential, positive = logarithmic)
	 */
	private interpolateWithCurve(
		start: number,
		end: number,
		t: number,
		curve: number,
	): number {
		const clampedT = Math.max(0, Math.min(1, t));

		if (curve === 0) {
			// Linear interpolation
			return start + (end - start) * clampedT;
		}

		// Apply curve transformation (from curves.applyCurvedT)
		const power = 1 + (Math.abs(curve) / 99) * 3;
		const curvedT = curve < 0 ? clampedT ** power : 1 - (1 - clampedT) ** power;

		return start + (end - start) * curvedT;
	}

	private applyRelease(voice: Voice, pad: SamplerPad): void {
		if (!voice.gainNode) return;

		const now = this.audioContext.currentTime;
		const envelope = pad.envelope;

		// FIX B: Use estimated level instead of gain.value
		const currentLevel = this.estimateEnvelopeLevel(voice, now);

		// Store for any future estimation needs
		voice.releaseLevelStart = currentLevel;

		// Cancel any scheduled changes
		voice.gainNode.gain.cancelScheduledValues(now);
		voice.gainNode.gain.setValueAtTime(currentLevel, now);

		// Release: current → 0
		const releaseDuration = envelope.release / 1000;

		if (releaseDuration > 0) {
			curves.applyCurveToParam(
				voice.gainNode.gain,
				currentLevel,
				0,
				now,
				releaseDuration,
				envelope.releaseCurve,
				this.audioContext,
			);
		} else {
			voice.gainNode.gain.setValueAtTime(0, now);
		}

		voice.state = "release";
		voice.releaseStartTime = now;

		// FIX C: Capture generation to guard the setTimeout
		const generation = voice.generation;

		// Schedule voice cleanup after release
		setTimeout(
			() => {
				// Guard: only cleanup if voice wasn't reused
				if (voice.generation !== generation) return;
				if (voice.state === "release") {
					voice.state = "finished";
					this.recycleVoice(voice);
				}
			},
			releaseDuration * 1000 + 10,
		); // +10ms buffer
	}

	private quickFadeOut(voice: Voice): void {
		if (!voice.gainNode) {
			voice.state = "finished";
			return;
		}

		const now = this.audioContext.currentTime;
		const fadeTime = this.voiceStealingConfig.fadeOutMs / 1000;

		// FIX B: Use estimated level instead of gain.value
		const currentGain = this.estimateEnvelopeLevel(voice, now);

		// Cancel any scheduled automation
		voice.gainNode.gain.cancelScheduledValues(now);
		voice.gainNode.gain.setValueAtTime(currentGain, now);

		// Linear fade to 0
		voice.gainNode.gain.linearRampToValueAtTime(0, now + fadeTime);

		voice.state = "release";
		voice.releaseStartTime = now;
		voice.releaseLevelStart = currentGain;

		// FIX C: Capture generation to guard the setTimeout
		const generation = voice.generation;

		// Schedule cleanup
		setTimeout(() => {
			// Guard: only update if voice wasn't reused
			if (voice.generation !== generation) return;
			voice.state = "finished";
		}, this.voiceStealingConfig.fadeOutMs + 1);
	}

	// ===========================================================================
	// Voice Cleanup
	// ===========================================================================

	private recycleVoice(voice: Voice): void {
		this.cleanupVoiceNodes(voice);

		// FIX A/E: Clean up note mapping
		this.cleanupNoteMapping(voice);

		// Reset state
		voice.state = "idle";
		voice.padId = "";
		voice.note = 0;
		voice.velocity = 0;
		voice.startTime = 0;
		voice.releaseStartTime = undefined;
		voice.releaseLevelStart = undefined;
		voice.peakLevel = 0;
		voice.sustainLevel = 0;
		// Note: Don't reset generation - it's used to invalidate old timeouts
	}

	private cleanupVoiceNodes(voice: Voice): void {
		if (voice.sourceNode) {
			try {
				voice.sourceNode.stop();
				voice.sourceNode.disconnect();
			} catch {
				// Source may already be stopped
			}
			voice.sourceNode = null;
		}

		if (voice.gainNode) {
			voice.gainNode.disconnect();
			voice.gainNode = null;
		}

		if (voice.pannerNode) {
			voice.pannerNode.disconnect();
			voice.pannerNode = null;
		}
	}

	// ===========================================================================
	// Choke Groups
	// ===========================================================================

	private handleChokeGroup(pad: SamplerPad): void {
		if (!pad.chokeGroup) return;

		for (const voice of this.voices.values()) {
			if (voice.state === "idle" || voice.state === "finished") continue;

			const voicePad = this.pads.get(voice.padId);
			if (
				voicePad &&
				voicePad.chokeGroup === pad.chokeGroup &&
				voicePad.id !== pad.id
			) {
				this.quickFadeOut(voice);
			}
		}
	}

	// ===========================================================================
	// Stop Methods
	// ===========================================================================

	private stopPadVoices(padId: string): void {
		for (const voice of this.voices.values()) {
			if (
				voice.padId === padId &&
				voice.state !== "idle" &&
				voice.state !== "finished"
			) {
				const pad = this.pads.get(padId);
				if (pad) {
					this.applyRelease(voice, pad);
				}
			}
		}
	}

	stopAllVoices(): void {
		for (const voice of this.voices.values()) {
			if (voice.state !== "idle" && voice.state !== "finished") {
				this.quickFadeOut(voice);
			}
		}
		this.noteToVoice.clear();
		this.toggledPads.clear();
	}

	// ===========================================================================
	// Voice Getters
	// ===========================================================================

	getActiveVoices(): Voice[] {
		return Array.from(this.voices.values()).filter(
			(v) => v.state !== "idle" && v.state !== "finished",
		);
	}

	getVoice(voiceId: string): Voice | undefined {
		return this.voices.get(voiceId);
	}

	// ===========================================================================
	// Output Routing
	// ===========================================================================

	connect(destination: AudioNode): void {
		this.outputGain.connect(destination);
	}

	disconnect(): void {
		this.outputGain.disconnect();
	}

	getOutputNode(): GainNode {
		return this.outputGain;
	}

	setMasterVolume(volume: number): void {
		this.outputGain.gain.value = Math.max(0, Math.min(1, volume));
	}

	getMasterVolume(): number {
		return this.outputGain.gain.value;
	}

	// ===========================================================================
	// Configuration
	// ===========================================================================

	setActiveVoiceCount(count: number): void {
		const newCount = Math.max(1, Math.min(count, this.config.maxVoices));

		// If reducing size, stop excess voices
		if (newCount < this.activeVoiceCount) {
			const activeVoices = this.getActiveVoices();
			const excess = activeVoices.length - newCount;
			if (excess > 0) {
				// Stop oldest voices first
				const sorted = activeVoices.sort((a, b) => a.startTime - b.startTime);
				for (let i = 0; i < excess; i++) {
					this.quickFadeOut(sorted[i]);
				}
			}
		}

		this.activeVoiceCount = newCount;
	}

	getActiveVoiceCount(): number {
		return this.activeVoiceCount;
	}

	getConfig(): SamplerConfig {
		return { ...this.config };
	}

	getVoiceStealingConfig(): VoiceStealingConfig {
		return { ...this.voiceStealingConfig };
	}

	setVoiceStealingConfig(config: Partial<VoiceStealingConfig>): void {
		this.voiceStealingConfig = { ...this.voiceStealingConfig, ...config };
	}

	// ===========================================================================
	// Event Helpers
	// ===========================================================================

	private emit<K extends keyof SamplerEventMap>(
		event: K,
		detail: SamplerEventMap[K],
	): void {
		this.dispatchEvent(new CustomEvent(event, { detail }));
	}

	// ===========================================================================
	// Disposal
	// ===========================================================================

	dispose(): void {
		this.stopAllVoices();
		this.outputGain.disconnect();
		this.pads.clear();
		this.voices.clear();
		this.noteToVoice.clear();
		this.toggledPads.clear();
	}
}
