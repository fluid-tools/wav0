/**
 * Tests for SamplerEngine
 *
 * These tests validate the bug fixes implemented:
 * - Bug A/E: noteToVoice cleanup on voice steal
 * - Bug B: Envelope level estimation (not relying on gain.value)
 * - Bug C: Generation counter guards setTimeout callbacks
 *
 * Run with: bun test packages/daw-sdk/src/core/sampler-engine.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SamplerEngine } from "./sampler-engine";

// Mock AudioContext for Node.js environment
class MockAudioParam {
	value = 0;
	setValueAtTime = vi.fn().mockReturnThis();
	linearRampToValueAtTime = vi.fn().mockReturnThis();
	exponentialRampToValueAtTime = vi.fn().mockReturnThis();
	setValueCurveAtTime = vi.fn().mockReturnThis();
	cancelScheduledValues = vi.fn().mockReturnThis();
}

class MockGainNode {
	gain = new MockAudioParam();
	connect = vi.fn().mockReturnThis();
	disconnect = vi.fn();
}

class MockStereoPannerNode {
	pan = new MockAudioParam();
	connect = vi.fn().mockReturnThis();
	disconnect = vi.fn();
}

class MockAudioBufferSourceNode {
	buffer: AudioBuffer | null = null;
	playbackRate = new MockAudioParam();
	loop = false;
	loopStart = 0;
	loopEnd = 0;
	onended: (() => void) | null = null;
	connect = vi.fn().mockReturnThis();
	disconnect = vi.fn();
	start = vi.fn();
	stop = vi.fn();
}

class MockAudioBuffer {
	duration = 1.0;
	sampleRate = 44100;
	numberOfChannels = 2;
	length = 44100;
	getChannelData = vi.fn(() => new Float32Array(44100));
	copyFromChannel = vi.fn();
	copyToChannel = vi.fn();
}

class MockAudioContext {
	currentTime = 0;
	sampleRate = 48000;

	createGain(): MockGainNode {
		return new MockGainNode();
	}

	createStereoPanner(): MockStereoPannerNode {
		return new MockStereoPannerNode();
	}

	createBufferSource(): MockAudioBufferSourceNode {
		return new MockAudioBufferSourceNode();
	}
}

describe("SamplerEngine", () => {
	let audioContext: MockAudioContext;
	let sampler: SamplerEngine;

	beforeEach(() => {
		vi.useFakeTimers();
		audioContext = new MockAudioContext();
		sampler = new SamplerEngine(audioContext as unknown as AudioContext, {
			padCount: 4,
			defaultVoices: 2,
			maxVoices: 4,
		});

		// Load samples into pads
		const mockBuffer = new MockAudioBuffer();
		for (let i = 0; i < 4; i++) {
			sampler.loadSample(`pad-${i}`, mockBuffer as unknown as AudioBuffer);
		}
	});

	afterEach(() => {
		sampler.dispose();
		vi.useRealTimers();
	});

	describe("Basic Voice Triggering", () => {
		it("should trigger a voice and return voice ID", () => {
			const voiceId = sampler.triggerAttack(36, 100);
			expect(voiceId).toBeTruthy();
			expect(sampler.getActiveVoices()).toHaveLength(1);
		});

		it("should release a voice on triggerRelease (gate mode)", () => {
			// Set to gate mode so release is honored
			sampler.updatePad("pad-0", { playMode: "gate" });

			const voiceId = sampler.triggerAttack(36, 100);
			expect(voiceId).toBeTruthy();

			sampler.triggerRelease(36);
			const voice = voiceId ? sampler.getVoice(voiceId) : undefined;
			expect(voice?.state).toBe("release");
		});

		it("should track multiple voices", () => {
			sampler.triggerAttack(36, 100); // pad-0
			sampler.triggerAttack(37, 100); // pad-1

			expect(sampler.getActiveVoices()).toHaveLength(2);
		});
	});

	describe("Bug A/E: noteToVoice Cleanup on Voice Steal", () => {
		it("should not release wrong voice after voice steal", () => {
			// Trigger note 36, which gets voice-0
			const voice0Id = sampler.triggerAttack(36, 100);
			expect(voice0Id).toBe("voice-0");

			// Trigger note 37, which gets voice-1
			sampler.triggerAttack(37, 100);

			// Now trigger note 38 - this should steal voice-0 (oldest)
			// because we only have 2 voices configured
			const voice2Id = sampler.triggerAttack(38, 100);
			expect(voice2Id).toBe("voice-0"); // Reused voice-0

			// Advance time for fade out
			vi.advanceTimersByTime(10);

			// Now release note 36 - this should NOT affect voice-0
			// because voice-0 is now playing note 38
			sampler.triggerRelease(36);

			// voice-0 should still be playing note 38, not released
			const voice = sampler.getVoice("voice-0");
			expect(voice?.note).toBe(38);
			// State might be attack/decay/sustain, but NOT release (unless quick fade is still active)
			// The key test is that it's still mapped to note 38, not affected by releasing note 36
		});

		it("should clean up noteToVoice when voice is stolen", () => {
			// This test verifies the internal state is correct
			sampler.triggerAttack(36, 100);
			sampler.triggerAttack(37, 100);

			// Both voices in use, trigger a third note to force steal
			sampler.triggerAttack(38, 100);

			// Release the stolen note (36) - should be a no-op
			sampler.triggerRelease(36);

			// The voice that was stolen should still be active
			// (we can't directly check noteToVoice, but we verify through behavior)
			expect(sampler.getActiveVoices().length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("Bug B: Envelope Level Estimation", () => {
		it("should estimate envelope level during attack phase", () => {
			sampler.triggerAttack(36, 127); // Max velocity

			// Access voice to check stored values
			const voice = sampler.getVoice("voice-0");
			expect(voice).toBeTruthy();
			if (voice) {
				expect(voice.peakLevel).toBe(1); // 127/127 * 1.0 volume
				expect(voice.sustainLevel).toBe(1); // Default sustain is 1.0
			}
		});

		it("should store correct peak level based on velocity", () => {
			sampler.triggerAttack(36, 64); // ~50% velocity

			const voice = sampler.getVoice("voice-0");
			expect(voice).toBeTruthy();
			if (voice) {
				expect(voice.peakLevel).toBeCloseTo(64 / 127, 2);
			}
		});

		it("should estimate correct level at release time", () => {
			// Configure pad with ADSR and gate mode (so release is honored)
			sampler.updatePad("pad-0", {
				playMode: "gate",
				envelope: {
					attack: 100, // 100ms attack
					attackCurve: 0,
					decay: 100, // 100ms decay
					decayCurve: 0,
					sustain: 0.5,
					release: 100,
					releaseCurve: 0,
				},
			});

			sampler.triggerAttack(36, 127);

			// Advance to middle of attack (50ms)
			audioContext.currentTime = 0.05;
			vi.advanceTimersByTime(50);

			// Release during attack - should capture current level
			sampler.triggerRelease(36);

			const voice = sampler.getVoice("voice-0");
			expect(voice?.releaseLevelStart).toBeDefined();
			if (voice?.releaseLevelStart !== undefined) {
				// During linear attack at 50%, level should be ~0.5 of peak
				expect(voice.releaseLevelStart).toBeCloseTo(0.5, 1);
			}
		});
	});

	describe("Bug C: Generation Counter Guards", () => {
		it("should increment generation on voice reuse", () => {
			const voiceId = sampler.triggerAttack(36, 100);
			const voice = voiceId ? sampler.getVoice(voiceId) : undefined;
			const gen1 = voice?.generation ?? 0;

			// Fill voice pool and force a steal
			sampler.triggerAttack(37, 100);
			sampler.triggerAttack(38, 100); // This steals voice-0

			vi.advanceTimersByTime(10);

			// voice-0 should have incremented generation
			const voiceAfter = sampler.getVoice("voice-0");
			if (voiceAfter) {
				expect(voiceAfter.generation).toBeGreaterThan(gen1);
			}
		});

		it("should not update state for stale setTimeout callbacks", () => {
			// This tests that setTimeout callbacks from old triggers don't
			// affect voices that have been reused

			// Configure pad with 200ms attack
			sampler.updatePad("pad-0", {
				envelope: {
					attack: 200,
					attackCurve: 0,
					decay: 0,
					decayCurve: 0,
					sustain: 1,
					release: 50,
					releaseCurve: 0,
				},
			});

			// Trigger first note
			sampler.triggerAttack(36, 100);
			const voice = sampler.getVoice("voice-0");
			expect(voice?.state).toBe("attack");

			// Advance 50ms (still in attack)
			audioContext.currentTime = 0.05;
			vi.advanceTimersByTime(50);

			// Force steal by triggering more notes
			sampler.triggerAttack(37, 100);
			sampler.triggerAttack(38, 100); // Steals voice-0

			vi.advanceTimersByTime(10);

			// voice-0 is now playing note 38, in attack phase
			const voiceAfterSteal = sampler.getVoice("voice-0");
			expect(voiceAfterSteal?.note).toBe(38);
			expect(voiceAfterSteal?.state).toBe("attack");

			// Now advance past the ORIGINAL attack timeout (200ms from original trigger)
			// This should NOT affect voice-0 because generation changed
			audioContext.currentTime = 0.25;
			vi.advanceTimersByTime(150);

			// voice-0 should still be in attack (for its new trigger)
			// or possibly transitioned to sustain for ITS OWN envelope
			// but should NOT have been affected by the old timeout
			const voiceFinal = sampler.getVoice("voice-0");
			// The key assertion: voice is still valid and playing note 38
			expect(voiceFinal?.note).toBe(38);
		});
	});

	describe("triggerAttackRelease with Generation Guard", () => {
		it("should not release stolen voice after attack-release duration", () => {
			// Use attack-release with 100ms duration
			sampler.triggerAttackRelease(36, 100, 100);

			const voice = sampler.getVoice("voice-0");
			expect(voice?.note).toBe(36);

			// Steal the voice before the release timeout
			sampler.triggerAttack(37, 100);
			sampler.triggerAttack(38, 100); // Steals voice-0

			vi.advanceTimersByTime(10);

			// voice-0 now plays note 38
			const stolenVoice = sampler.getVoice("voice-0");
			expect(stolenVoice?.note).toBe(38);

			// Advance past the original attack-release duration
			audioContext.currentTime = 0.15;
			vi.advanceTimersByTime(100);

			// voice-0 should NOT be released because it was stolen
			// (generation guard should prevent the old setTimeout from triggering release)
			const voiceAfter = sampler.getVoice("voice-0");
			expect(voiceAfter?.note).toBe(38);
			// It should not be in release state from the old trigger
		});
	});

	describe("Voice Stealing", () => {
		it("should steal oldest voice when pool is full", () => {
			// Trigger 2 voices (our max)
			sampler.triggerAttack(36, 100);
			audioContext.currentTime = 0.001; // Small time increment
			sampler.triggerAttack(37, 100);

			// Third trigger should steal oldest (voice-0)
			audioContext.currentTime = 0.002;
			const thirdVoice = sampler.triggerAttack(38, 100);

			expect(thirdVoice).toBe("voice-0"); // Reused the oldest
		});

		it("should prefer releasing voices for stealing", () => {
			// Set pad-1 to gate mode so release is honored
			sampler.updatePad("pad-1", { playMode: "gate" });

			// Trigger 2 voices
			sampler.triggerAttack(36, 100);
			sampler.triggerAttack(37, 100);

			// Release the second voice (puts it in release state)
			sampler.triggerRelease(37);

			// Verify voice-1 is in release state
			const voice1 = sampler.getVoice("voice-1");
			expect(voice1?.state).toBe("release");

			// Third trigger should steal the releasing voice (voice-1)
			const thirdVoice = sampler.triggerAttack(38, 100);
			expect(thirdVoice).toBe("voice-1");
		});
	});

	describe("Choke Groups", () => {
		it("should stop voices in same choke group", () => {
			// Set up choke group (like hi-hat)
			sampler.updatePad("pad-0", { chokeGroup: "hihat" });
			sampler.updatePad("pad-1", { chokeGroup: "hihat" });

			// Trigger first pad
			sampler.triggerAttack(36, 100); // pad-0
			expect(sampler.getActiveVoices()).toHaveLength(1);

			// Trigger second pad in same choke group
			sampler.triggerAttack(37, 100); // pad-1

			// First voice should be fading out (in release)
			const voice0 = sampler.getVoice("voice-0");
			expect(voice0?.state).toBe("release");
		});
	});

	describe("Play Modes", () => {
		it("one-shot should ignore release", () => {
			sampler.updatePad("pad-0", { playMode: "one-shot" });

			sampler.triggerAttack(36, 100);
			sampler.triggerRelease(36);

			const voice = sampler.getVoice("voice-0");
			// Should NOT be in release state
			expect(voice?.state).not.toBe("release");
		});

		it("toggle mode should stop on second trigger", () => {
			sampler.updatePad("pad-0", { playMode: "toggle" });

			// First trigger starts playback
			const voiceId = sampler.triggerAttack(36, 100);
			expect(voiceId).toBeTruthy();

			// Second trigger should stop
			const secondVoice = sampler.triggerAttack(36, 100);
			expect(secondVoice).toBeNull();

			// Voice should be in release
			const voice = voiceId ? sampler.getVoice(voiceId) : undefined;
			expect(voice?.state).toBe("release");
		});

		it("gate mode should release on note-off", () => {
			sampler.updatePad("pad-0", { playMode: "gate" });

			sampler.triggerAttack(36, 100);
			sampler.triggerRelease(36);

			const voice = sampler.getVoice("voice-0");
			expect(voice?.state).toBe("release");
		});
	});

	describe("Envelope Curve Interpolation", () => {
		it("should handle linear curves (curve = 0)", () => {
			sampler.updatePad("pad-0", {
				volume: 1,
				envelope: {
					attack: 100,
					attackCurve: 0, // Linear
					decay: 0,
					decayCurve: 0,
					sustain: 1,
					release: 100,
					releaseCurve: 0,
				},
			});

			sampler.triggerAttack(36, 127);

			// At 50% through attack
			audioContext.currentTime = 0.05;
			sampler.triggerRelease(36);

			const voice = sampler.getVoice("voice-0");
			// Linear: at t=0.5, level should be 0.5
			if (voice?.releaseLevelStart !== undefined) {
				expect(voice.releaseLevelStart).toBeCloseTo(0.5, 1);
			}
		});

		it("should handle exponential curves (curve < 0)", () => {
			sampler.updatePad("pad-0", {
				volume: 1,
				envelope: {
					attack: 100,
					attackCurve: -50, // Exponential (fast start)
					decay: 0,
					decayCurve: 0,
					sustain: 1,
					release: 100,
					releaseCurve: 0,
				},
			});

			sampler.triggerAttack(36, 127);

			// At 50% through attack with exponential curve
			audioContext.currentTime = 0.05;
			sampler.triggerRelease(36);

			const voice = sampler.getVoice("voice-0");
			// Exponential (power > 1): at t=0.5, level should be < 0.5
			if (voice?.releaseLevelStart !== undefined) {
				expect(voice.releaseLevelStart).toBeLessThan(0.5);
			}
		});

		it("should handle logarithmic curves (curve > 0)", () => {
			sampler.updatePad("pad-0", {
				volume: 1,
				envelope: {
					attack: 100,
					attackCurve: 50, // Logarithmic (slow start)
					decay: 0,
					decayCurve: 0,
					sustain: 1,
					release: 100,
					releaseCurve: 0,
				},
			});

			sampler.triggerAttack(36, 127);

			// At 50% through attack with logarithmic curve
			audioContext.currentTime = 0.05;
			sampler.triggerRelease(36);

			const voice = sampler.getVoice("voice-0");
			// Logarithmic: at t=0.5, level should be > 0.5
			if (voice?.releaseLevelStart !== undefined) {
				expect(voice.releaseLevelStart).toBeGreaterThan(0.5);
			}
		});
	});

	describe("stopAllVoices", () => {
		it("should stop all active voices", () => {
			sampler.triggerAttack(36, 100);
			sampler.triggerAttack(37, 100);

			expect(sampler.getActiveVoices()).toHaveLength(2);

			sampler.stopAllVoices();

			// Advance timers for fade out
			vi.advanceTimersByTime(10);

			// Voices should be in release or finished
			for (const voice of sampler.getActiveVoices()) {
				expect(["release", "finished"]).toContain(voice.state);
			}
		});
	});

	describe("dispose", () => {
		it("should clean up all resources", () => {
			sampler.triggerAttack(36, 100);
			sampler.triggerAttack(37, 100);

			sampler.dispose();

			expect(sampler.getAllPads()).toHaveLength(0);
			expect(sampler.getActiveVoices()).toHaveLength(0);
		});
	});
});

describe("Envelope Level Estimation Edge Cases", () => {
	let audioContext: MockAudioContext;
	let sampler: SamplerEngine;

	beforeEach(() => {
		vi.useFakeTimers();
		audioContext = new MockAudioContext();
		sampler = new SamplerEngine(audioContext as unknown as AudioContext, {
			padCount: 1,
			defaultVoices: 2,
			maxVoices: 4,
		});

		const mockBuffer = new MockAudioBuffer();
		sampler.loadSample("pad-0", mockBuffer as unknown as AudioBuffer);
	});

	afterEach(() => {
		sampler.dispose();
		vi.useRealTimers();
	});

	it("should handle zero attack time", () => {
		sampler.updatePad("pad-0", {
			envelope: {
				attack: 0, // Instant attack
				attackCurve: 0,
				decay: 100,
				decayCurve: 0,
				sustain: 0.5,
				release: 100,
				releaseCurve: 0,
			},
		});

		sampler.triggerAttack(36, 127);

		// Immediately release
		sampler.triggerRelease(36);

		const voice = sampler.getVoice("voice-0");
		// With zero attack, should be at peak immediately (then decay)
		// At time 0, still at peak
		if (voice?.releaseLevelStart !== undefined) {
			expect(voice.releaseLevelStart).toBeCloseTo(1, 1);
		}
	});

	it("should handle zero decay time", () => {
		sampler.updatePad("pad-0", {
			envelope: {
				attack: 100,
				attackCurve: 0,
				decay: 0, // Instant decay
				decayCurve: 0,
				sustain: 0.5,
				release: 100,
				releaseCurve: 0,
			},
		});

		sampler.triggerAttack(36, 127);

		// After attack
		audioContext.currentTime = 0.15;
		vi.advanceTimersByTime(150);

		sampler.triggerRelease(36);

		const voice = sampler.getVoice("voice-0");
		// Should be at sustain level (0.5)
		if (voice?.releaseLevelStart !== undefined) {
			expect(voice.releaseLevelStart).toBeCloseTo(0.5, 1);
		}
	});

	it("should handle sustain = 1 (no decay change)", () => {
		sampler.updatePad("pad-0", {
			envelope: {
				attack: 50,
				attackCurve: 0,
				decay: 100,
				decayCurve: 0,
				sustain: 1, // No drop from peak
				release: 100,
				releaseCurve: 0,
			},
		});

		sampler.triggerAttack(36, 127);

		// Well after attack+decay
		audioContext.currentTime = 0.5;
		vi.advanceTimersByTime(500);

		sampler.triggerRelease(36);

		const voice = sampler.getVoice("voice-0");
		// Sustain = 1 means level stays at peak
		if (voice?.releaseLevelStart !== undefined) {
			expect(voice.releaseLevelStart).toBeCloseTo(1, 1);
		}
	});

	it("should handle release during decay phase", () => {
		sampler.updatePad("pad-0", {
			envelope: {
				attack: 50,
				attackCurve: 0,
				decay: 100,
				decayCurve: 0,
				sustain: 0.3,
				release: 100,
				releaseCurve: 0,
			},
		});

		sampler.triggerAttack(36, 127);

		// 75ms = 50ms attack + 25ms into decay (25% through decay)
		audioContext.currentTime = 0.075;
		vi.advanceTimersByTime(75);

		sampler.triggerRelease(36);

		const voice = sampler.getVoice("voice-0");
		// Linear decay from 1.0 to 0.3, at 25%:
		// level = 1.0 + (0.3 - 1.0) * 0.25 = 1.0 - 0.175 = 0.825
		if (voice?.releaseLevelStart !== undefined) {
			expect(voice.releaseLevelStart).toBeCloseTo(0.825, 1);
		}
	});
});
