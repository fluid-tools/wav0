# Sampler Engine Architecture Plan

> **Created**: 2025-01-20
> **Status**: Planning
> **Package**: `packages/daw-sdk`
> **Estimated Lines**: ~600

---

## Table of Contents

1. [Overview](#overview)
2. [Design Decisions](#design-decisions)
3. [Architecture](#architecture)
4. [Type Definitions](#type-definitions)
5. [SamplerEngine Class](#samplerengine-class)
6. [Pitch & Time Manipulation](#pitch--time-manipulation)
7. [ADSR Envelope](#adsr-envelope)
8. [Integration Points](#integration-points)
9. [Implementation Order](#implementation-order)
10. [File Structure](#file-structure)

---

## Overview

The SamplerEngine is a trigger-based audio playback system for the WAV0 DAW. Unlike the timeline-based Transport (which plays clips at specific positions), the SamplerEngine responds to MIDI note triggers and plays samples with configurable pitch, time stretch, and envelope shaping.

### Goals

- **Configurable pad count**: Default 16 (4x4 MPC-style), expandable to 64+
- **Pitch shifting**: Semitone-based pitch control via playback rate
- **Time stretching**: Duration-preserving speed changes (granular synthesis)
- **Transpose**: Combined pitch+time for musical transposition
- **ADSR envelopes**: Attack, Decay, Sustain, Release with curve support
- **Voice management**: 32 max voices, 4 default, with voice stealing
- **Bus routing ready**: Output node for DAW track integration

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pad count | Configurable, default 16 | MPC-style familiar, expandable for power users |
| Pitch implementation | `playbackRate` + granular | Native Web Audio for simple, granular for quality |
| Time stretch | Granular synthesis | Preserves duration while changing pitch |
| Transpose | Pitch + time combined | Like Logic Pro's Flex Pitch |
| Max voices | 32 | Desktop-focused, covers most use cases |
| Default voices | 4 | Conservative start, user can increase |
| Voice stealing | Release → Oldest → Lowest velocity | First-principles priority order |
| Envelope curves | Reuse `curves.ts` | Already implemented, Logic Pro style |
| Output routing | Single GainNode | Easy bus connection point |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SAMPLER ENGINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         PAD BANK                                     │    │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                                    │    │
│  │  │Pad 1│ │Pad 2│ │Pad 3│ │Pad 4│  ... up to 64 pads                 │    │
│  │  │C1   │ │C#1  │ │D1   │ │D#1  │                                    │    │
│  │  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘                                    │    │
│  └─────┼───────┼───────┼───────┼───────────────────────────────────────┘    │
│        │       │       │       │                                             │
│        ▼       ▼       ▼       ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       VOICE POOL                                     │    │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                            │    │
│  │  │Voice 1│ │Voice 2│ │Voice 3│ │Voice 4│  ... up to 32 voices       │    │
│  │  │Source │ │Source │ │Source │ │Source │                            │    │
│  │  │+ Gain │ │+ Gain │ │+ Gain │ │+ Gain │                            │    │
│  │  │+ ADSR │ │+ ADSR │ │+ ADSR │ │+ ADSR │                            │    │
│  │  └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘                            │    │
│  └──────┼────────┼────────┼────────┼───────────────────────────────────┘    │
│         │        │        │        │                                         │
│         ▼        ▼        ▼        ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      OUTPUT STAGE                                    │    │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │    │
│  │  │ Voice Mixer  │───▶│ Master Gain  │───▶│ Panner/Stereo│──▶ OUT    │    │
│  │  │ (sum all)    │    │ (volume)     │    │              │           │    │
│  │  └──────────────┘    └──────────────┘    └──────────────┘           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
                            ┌──────────────┐
                            │  DAW Track   │
                            │  (Bus Input) │
                            └──────────────┘
```

---

## Type Definitions

**File**: `packages/daw-sdk/src/types/sampler.ts`

```typescript
// ============================================================================
// Sampler Configuration
// ============================================================================

export interface SamplerConfig {
  /** Maximum simultaneous voices (default: 32, max: 64) */
  maxVoices: number
  /** Default active voice count (default: 4) */
  defaultVoices: number
  /** Number of pads (default: 16, max: 64) */
  padCount: number
  /** Pad layout for UI hints */
  padLayout: PadLayout
  /** Base MIDI note for first pad (default: 36 = C1) */
  baseNote: number
}

export type PadLayout = 
  | { type: '4x4'; rows: 4; cols: 4 }      // 16 pads (MPC)
  | { type: '8x8'; rows: 8; cols: 8 }      // 64 pads (Push)
  | { type: 'custom'; rows: number; cols: number }

export const DEFAULT_SAMPLER_CONFIG: SamplerConfig = {
  maxVoices: 32,
  defaultVoices: 4,
  padCount: 16,
  padLayout: { type: '4x4', rows: 4, cols: 4 },
  baseNote: 36, // C1
}

// ============================================================================
// Pad Definition
// ============================================================================

export interface SamplerPad {
  /** Unique pad identifier */
  id: string
  /** Pad index (0-based) */
  index: number
  /** Display name */
  name: string
  /** Loaded audio buffer (null if empty) */
  audioBuffer: AudioBuffer | null
  /** Sample file info */
  sampleInfo?: {
    fileName: string
    duration: number      // seconds
    sampleRate: number
    channels: number
  }
  
  // === Key/Note Mapping ===
  /** Root note this sample is tuned to (default: 60 = C4) */
  rootNote: number
  /** MIDI note that triggers this pad (derived from baseNote + index) */
  triggerNote: number
  /** Optional key range for chromatic play [low, high] */
  keyRange?: [number, number]
  
  // === Pitch Controls ===
  /** 
   * Pitch shift in semitones (-24 to +24)
   * Changes pitch WITHOUT preserving duration (uses playbackRate)
   */
  pitchShift: number
  /** Fine tune in cents (-100 to +100) */
  fineTune: number
  
  // === Time Controls ===
  /**
   * Time stretch ratio (0.25 to 4.0, 1.0 = original)
   * Changes duration WITHOUT changing pitch (granular)
   */
  timeStretch: number
  
  // === Transpose (Combined) ===
  /**
   * Musical transpose in semitones (-24 to +24)
   * Changes pitch AND adjusts time to preserve musical timing
   * Like Logic Pro's "Flex Pitch" or Ableton's "Transpose"
   */
  transpose: number
  
  // === Envelope (ADSR) ===
  envelope: ADSREnvelope
  
  // === Output ===
  /** Volume (0 to 1, default: 1) */
  volume: number
  /** Pan (-1 = left, 0 = center, 1 = right) */
  pan: number
  /** Muted */
  muted: boolean
  /** Solo */
  soloed: boolean
  
  // === Playback Options ===
  /** Play mode */
  playMode: PlayMode
  /** Reverse playback */
  reverse: boolean
  /** Loop settings */
  loop: {
    enabled: boolean
    start: number   // 0-1 normalized position
    end: number     // 0-1 normalized position
  }
  
  // === Display ===
  /** Pad color (hex) */
  color: string
}

export type PlayMode = 
  | 'one-shot'      // Play full sample, ignore note-off
  | 'gate'          // Play while held, release on note-off
  | 'toggle'        // Note-on starts, next note-on stops
  | 'latch'         // Note-on starts, plays until end or next trigger

// ============================================================================
// ADSR Envelope
// ============================================================================

export interface ADSREnvelope {
  /** Attack time in milliseconds (0 to 10000) */
  attack: number
  /** Attack curve (-99 to +99, 0 = linear) */
  attackCurve: number
  /** Decay time in milliseconds (0 to 10000) */
  decay: number
  /** Decay curve (-99 to +99) */
  decayCurve: number
  /** Sustain level (0 to 1) */
  sustain: number
  /** Release time in milliseconds (0 to 10000) */
  release: number
  /** Release curve (-99 to +99) */
  releaseCurve: number
}

export const DEFAULT_ENVELOPE: ADSREnvelope = {
  attack: 0,
  attackCurve: 0,
  decay: 0,
  decayCurve: 0,
  sustain: 1,
  release: 50,
  releaseCurve: -30,  // Slight exponential for natural decay
}

// ============================================================================
// Voice State
// ============================================================================

export interface Voice {
  /** Unique voice identifier */
  id: string
  /** Pad this voice is playing */
  padId: string
  /** MIDI note that triggered this voice */
  note: number
  /** Trigger velocity (0-127) */
  velocity: number
  /** Voice state */
  state: VoiceState
  /** AudioContext time when voice started */
  startTime: number
  /** AudioContext time when release started (if releasing) */
  releaseStartTime?: number
  
  // === Audio Nodes (internal) ===
  sourceNode: AudioBufferSourceNode | null
  gainNode: GainNode | null
  pannerNode: StereoPannerNode | null
}

export type VoiceState = 
  | 'idle'        // Available for use
  | 'attack'      // In attack phase
  | 'decay'       // In decay phase  
  | 'sustain'     // Holding at sustain level
  | 'release'     // Fading out
  | 'finished'    // Completed, ready for cleanup

// ============================================================================
// Voice Stealing
// ============================================================================

export type VoiceStealingMode = 
  | 'oldest'           // Steal oldest voice first
  | 'lowest-velocity'  // Steal quietest voice first
  | 'same-note'        // Only steal same note (retrigger)
  | 'none'             // Don't steal, reject new notes

export interface VoiceStealingConfig {
  mode: VoiceStealingMode
  /** Fade out time when stealing (ms) */
  fadeOutMs: number
  /** Prioritize stealing voices in release state */
  preferReleasing: boolean
}

export const DEFAULT_VOICE_STEALING: VoiceStealingConfig = {
  mode: 'oldest',
  fadeOutMs: 5,
  preferReleasing: true,
}

// ============================================================================
// Sampler Events
// ============================================================================

export interface SamplerEventMap {
  'voice:start': { voiceId: string; padId: string; note: number; velocity: number }
  'voice:release': { voiceId: string; padId: string; note: number }
  'voice:end': { voiceId: string; padId: string; note: number }
  'voice:stolen': { voiceId: string; stolenBy: string }
  'pad:loaded': { padId: string; buffer: AudioBuffer }
  'pad:cleared': { padId: string }
}
```

---

## SamplerEngine Class

**File**: `packages/daw-sdk/src/core/sampler-engine.ts`

```typescript
import type {
  SamplerConfig,
  SamplerPad,
  Voice,
  VoiceStealingConfig,
  ADSREnvelope,
  SamplerEventMap,
} from '../types/sampler'
import { curves } from '../utils/curves'

export class SamplerEngine extends EventTarget {
  private audioContext: AudioContext
  private config: SamplerConfig
  private voiceStealingConfig: VoiceStealingConfig
  
  private pads: Map<string, SamplerPad> = new Map()
  private voices: Map<string, Voice> = new Map()
  private noteToVoice: Map<number, string> = new Map()  // For release tracking
  
  private outputGain: GainNode
  private activeVoiceCount: number
  
  constructor(
    audioContext: AudioContext,
    config?: Partial<SamplerConfig>,
    voiceStealing?: Partial<VoiceStealingConfig>
  ) {
    super()
    this.audioContext = audioContext
    this.config = { ...DEFAULT_SAMPLER_CONFIG, ...config }
    this.voiceStealingConfig = { ...DEFAULT_VOICE_STEALING, ...voiceStealing }
    this.activeVoiceCount = this.config.defaultVoices
    
    // Create output stage
    this.outputGain = audioContext.createGain()
    this.outputGain.gain.value = 1
    
    // Initialize pads
    this.initializePads()
  }
  
  // ===========================================================================
  // Initialization
  // ===========================================================================
  
  private initializePads(): void {
    for (let i = 0; i < this.config.padCount; i++) {
      const padId = `pad-${i}`
      const triggerNote = this.config.baseNote + i
      
      this.pads.set(padId, {
        id: padId,
        index: i,
        name: `Pad ${i + 1}`,
        audioBuffer: null,
        rootNote: 60,  // C4
        triggerNote,
        pitchShift: 0,
        fineTune: 0,
        timeStretch: 1,
        transpose: 0,
        envelope: { ...DEFAULT_ENVELOPE },
        volume: 1,
        pan: 0,
        muted: false,
        soloed: false,
        playMode: 'one-shot',
        reverse: false,
        loop: { enabled: false, start: 0, end: 1 },
        color: '#3b82f6',
      })
    }
  }
  
  // ===========================================================================
  // Pad Management
  // ===========================================================================
  
  getPad(padId: string): SamplerPad | undefined {
    return this.pads.get(padId)
  }
  
  getPadByNote(note: number): SamplerPad | undefined {
    for (const pad of this.pads.values()) {
      if (pad.triggerNote === note) return pad
      if (pad.keyRange && note >= pad.keyRange[0] && note <= pad.keyRange[1]) {
        return pad
      }
    }
    return undefined
  }
  
  getPadByIndex(index: number): SamplerPad | undefined {
    return this.pads.get(`pad-${index}`)
  }
  
  getAllPads(): SamplerPad[] {
    return Array.from(this.pads.values())
  }
  
  updatePad(padId: string, updates: Partial<SamplerPad>): void {
    const pad = this.pads.get(padId)
    if (!pad) return
    
    this.pads.set(padId, { ...pad, ...updates })
  }
  
  async loadSample(padId: string, audioBuffer: AudioBuffer): Promise<void> {
    const pad = this.pads.get(padId)
    if (!pad) throw new Error(`Pad not found: ${padId}`)
    
    this.pads.set(padId, {
      ...pad,
      audioBuffer,
      sampleInfo: {
        fileName: 'loaded',
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
      },
    })
    
    this.emit('pad:loaded', { padId, buffer: audioBuffer })
  }
  
  clearSample(padId: string): void {
    const pad = this.pads.get(padId)
    if (!pad) return
    
    this.pads.set(padId, {
      ...pad,
      audioBuffer: null,
      sampleInfo: undefined,
    })
    
    this.emit('pad:cleared', { padId })
  }
  
  // ===========================================================================
  // Voice Triggering
  // ===========================================================================
  
  triggerAttack(note: number, velocity: number): string | null {
    const pad = this.getPadByNote(note)
    if (!pad || !pad.audioBuffer || pad.muted) return null
    
    // Check for solo (if any pad is soloed, only play soloed pads)
    const hasSolo = Array.from(this.pads.values()).some(p => p.soloed)
    if (hasSolo && !pad.soloed) return null
    
    // Get or steal a voice
    const voice = this.acquireVoice(pad, note, velocity)
    if (!voice) return null
    
    // Create audio nodes
    this.setupVoiceNodes(voice, pad, velocity)
    
    // Apply ADSR attack
    this.applyAttack(voice, pad)
    
    // Start playback
    this.startVoicePlayback(voice, pad)
    
    // Track note for release
    this.noteToVoice.set(note, voice.id)
    
    this.emit('voice:start', {
      voiceId: voice.id,
      padId: pad.id,
      note,
      velocity,
    })
    
    return voice.id
  }
  
  triggerRelease(note: number): void {
    const voiceId = this.noteToVoice.get(note)
    if (!voiceId) return
    
    const voice = this.voices.get(voiceId)
    if (!voice || voice.state === 'release' || voice.state === 'finished') return
    
    const pad = this.pads.get(voice.padId)
    if (!pad) return
    
    // One-shot ignores release
    if (pad.playMode === 'one-shot') return
    
    // Apply release envelope
    this.applyRelease(voice, pad)
    
    this.noteToVoice.delete(note)
    
    this.emit('voice:release', {
      voiceId: voice.id,
      padId: pad.id,
      note,
    })
  }
  
  triggerAttackRelease(note: number, velocity: number, durationMs: number): void {
    const voiceId = this.triggerAttack(note, velocity)
    if (!voiceId) return
    
    setTimeout(() => {
      this.triggerRelease(note)
    }, durationMs)
  }
  
  // ===========================================================================
  // Voice Management (See voice_management.plan.md for details)
  // ===========================================================================
  
  private acquireVoice(pad: SamplerPad, note: number, velocity: number): Voice | null {
    // Find idle voice
    for (const voice of this.voices.values()) {
      if (voice.state === 'idle' || voice.state === 'finished') {
        return this.initializeVoice(voice, pad, note, velocity)
      }
    }
    
    // Need to create or steal
    if (this.voices.size < this.activeVoiceCount) {
      return this.createVoice(pad, note, velocity)
    }
    
    // Steal a voice
    return this.stealVoice(pad, note, velocity)
  }
  
  private stealVoice(pad: SamplerPad, note: number, velocity: number): Voice | null {
    if (this.voiceStealingConfig.mode === 'none') return null
    
    const candidates = Array.from(this.voices.values())
      .filter(v => v.state !== 'idle' && v.state !== 'finished')
    
    if (candidates.length === 0) return null
    
    let victim: Voice | null = null
    
    // Prefer releasing voices
    if (this.voiceStealingConfig.preferReleasing) {
      const releasing = candidates.filter(v => v.state === 'release')
      if (releasing.length > 0) {
        victim = releasing.reduce((oldest, v) => 
          v.startTime < oldest.startTime ? v : oldest
        )
      }
    }
    
    // Apply stealing mode
    if (!victim) {
      switch (this.voiceStealingConfig.mode) {
        case 'oldest':
          victim = candidates.reduce((oldest, v) => 
            v.startTime < oldest.startTime ? v : oldest
          )
          break
        case 'lowest-velocity':
          victim = candidates.reduce((quietest, v) => 
            v.velocity < quietest.velocity ? v : quietest
          )
          break
        case 'same-note':
          victim = candidates.find(v => v.note === note) || null
          break
      }
    }
    
    if (!victim) return null
    
    // Quick fade out
    this.quickFadeOut(victim)
    
    this.emit('voice:stolen', { voiceId: victim.id, stolenBy: `new-${note}` })
    
    return this.initializeVoice(victim, pad, note, velocity)
  }
  
  // ... (continued in implementation)
  
  // ===========================================================================
  // Output Routing
  // ===========================================================================
  
  connect(destination: AudioNode): void {
    this.outputGain.connect(destination)
  }
  
  disconnect(): void {
    this.outputGain.disconnect()
  }
  
  getOutputNode(): GainNode {
    return this.outputGain
  }
  
  // ===========================================================================
  // Configuration
  // ===========================================================================
  
  setActiveVoiceCount(count: number): void {
    this.activeVoiceCount = Math.min(count, this.config.maxVoices)
  }
  
  getActiveVoiceCount(): number {
    return this.activeVoiceCount
  }
  
  setPadCount(count: number): void {
    // Add or remove pads as needed
    // ... implementation
  }
  
  // ===========================================================================
  // Event Helpers
  // ===========================================================================
  
  private emit<K extends keyof SamplerEventMap>(
    event: K,
    detail: SamplerEventMap[K]
  ): void {
    this.dispatchEvent(new CustomEvent(event, { detail }))
  }
}
```

---

## Pitch & Time Manipulation

### Pitch Shift (Simple - Changes Duration)

Uses Web Audio's native `playbackRate`:

```typescript
// Semitones to playback rate
function semitonesToRate(semitones: number): number {
  return Math.pow(2, semitones / 12)
}

// Example: +12 semitones (octave up) = 2.0 rate (half duration)
// Example: -12 semitones (octave down) = 0.5 rate (double duration)

// Apply to source
sourceNode.playbackRate.value = semitonesToRate(pad.pitchShift + pad.fineTune / 100)
```

### Time Stretch (Complex - Preserves Duration)

Uses granular synthesis for quality time stretching:

```typescript
/**
 * Time stretch using granular synthesis
 * 
 * Approach: Break audio into small "grains" (~20-50ms),
 * overlap them, and space them according to stretch ratio.
 * 
 * For MVP, we can use a simplified approach:
 * 1. If timeStretch < 1 (speed up): Skip grains
 * 2. If timeStretch > 1 (slow down): Repeat/crossfade grains
 */

class GranularTimeStretch {
  private grainSize = 0.04  // 40ms grains
  private overlap = 0.5     // 50% overlap
  
  stretch(buffer: AudioBuffer, ratio: number): AudioBuffer {
    // ... granular processing
  }
}
```

**MVP Approach**: For initial implementation, use `playbackRate` for both pitch and time (accepting duration change). Add true granular time-stretch in v2.

### Transpose (Musical)

Combines pitch shift with inverse time stretch to maintain musical timing:

```typescript
function applyTranspose(sourceNode: AudioBufferSourceNode, semitones: number): void {
  // For true transpose, we need:
  // 1. Pitch shift up by semitones
  // 2. Time stretch to compensate
  
  // MVP: Just use pitch shift (duration changes)
  sourceNode.playbackRate.value = semitonesToRate(semitones)
  
  // Future: Granular transpose
  // const pitchRate = semitonesToRate(semitones)
  // const timeCompensation = 1 / pitchRate
  // Apply granular stretch at timeCompensation
  // Then apply pitchRate
}
```

---

## ADSR Envelope

Uses the existing `curves.ts` for envelope shaping:

```typescript
import { curves } from '../utils/curves'

function applyADSR(
  gainNode: GainNode,
  envelope: ADSREnvelope,
  velocity: number,
  audioContext: AudioContext
): void {
  const now = audioContext.currentTime
  const velocityScale = velocity / 127
  const peakLevel = velocityScale  // Velocity affects peak
  
  // Start at 0
  gainNode.gain.setValueAtTime(0, now)
  
  // Attack: 0 → peak
  const attackEnd = now + envelope.attack / 1000
  curves.applyCurveToParam(
    gainNode.gain,
    0,
    peakLevel,
    now,
    envelope.attack / 1000,
    envelope.attackCurve,
    audioContext
  )
  
  // Decay: peak → sustain
  const sustainLevel = peakLevel * envelope.sustain
  const decayEnd = attackEnd + envelope.decay / 1000
  curves.applyCurveToParam(
    gainNode.gain,
    peakLevel,
    sustainLevel,
    attackEnd,
    envelope.decay / 1000,
    envelope.decayCurve,
    audioContext
  )
}

function applyRelease(
  gainNode: GainNode,
  envelope: ADSREnvelope,
  audioContext: AudioContext
): void {
  const now = audioContext.currentTime
  const currentLevel = gainNode.gain.value
  
  // Cancel any scheduled changes
  gainNode.gain.cancelScheduledValues(now)
  gainNode.gain.setValueAtTime(currentLevel, now)
  
  // Release: current → 0
  curves.applyCurveToParam(
    gainNode.gain,
    currentLevel,
    0,
    now,
    envelope.release / 1000,
    envelope.releaseCurve,
    audioContext
  )
}
```

---

## Integration Points

### With MIDIService

```typescript
// In application code
const midi = new MIDIService()
const sampler = new SamplerEngine(audioContext)

midi.addEventListener('noteon', (e) => {
  const { note, velocity } = (e as CustomEvent).detail
  sampler.triggerAttack(note, velocity)
})

midi.addEventListener('noteoff', (e) => {
  const { note } = (e as CustomEvent).detail
  sampler.triggerRelease(note)
})
```

### With DAW Track (Future)

```typescript
// Track instrument slot
class Track {
  private instrument: SamplerEngine | null = null
  private outputBus: Bus
  
  setInstrument(sampler: SamplerEngine): void {
    this.instrument = sampler
    sampler.connect(this.outputBus.getInputNode())
  }
}
```

### With MIDIPlayer (Sequenced Playback)

```typescript
const player = new MIDIPlayer({
  onNoteOn: (note, velocity, channel) => {
    sampler.triggerAttack(note, velocity)
  },
  onNoteOff: (note, channel) => {
    sampler.triggerRelease(note)
  },
})
```

---

## Implementation Order

1. **Types** (`types/sampler.ts`) - ~150 lines
   - All interfaces and type definitions
   - Default configurations

2. **Core Engine** (`core/sampler-engine.ts`) - ~350 lines
   - Pad management
   - Basic voice triggering (without stealing)
   - Simple pitch shift via playbackRate
   - ADSR envelopes using curves.ts
   - Output routing

3. **Voice Management** (add to sampler-engine.ts) - ~100 lines
   - Voice pool management
   - Voice stealing algorithm
   - Voice state tracking

4. **Time Stretch** (`utils/granular.ts`) - ~200 lines (v2)
   - Granular synthesis for time stretch
   - True transpose implementation

---

## File Structure

```
packages/daw-sdk/src/
├── types/
│   ├── sampler.ts           # NEW - Sampler type definitions
│   └── index.ts             # UPDATE - export sampler types
├── core/
│   ├── sampler-engine.ts    # NEW - Main sampler class
│   └── index.ts             # UPDATE - export sampler
└── utils/
    └── granular.ts          # NEW (v2) - Time stretch utilities
```

---

## Related Plans

- [Voice Management](./voice_management.plan.md) - Detailed voice stealing algorithms
- [Bus Architecture](./bus_architecture.plan.md) - DAW routing system
- [MIDI Integration](../midi_integration.plan.md) - MIDI input handling
