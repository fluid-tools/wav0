# Bus Architecture Plan

> **Created**: 2025-01-20
> **Status**: Planning
> **Package**: `packages/daw-sdk`
> **Priority**: Phase 2 (after Sampler MVP)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Signal Flow](#signal-flow)
4. [Type Definitions](#type-definitions)
5. [Bus Class](#bus-class)
6. [Track Routing](#track-routing)
7. [Send/Return System](#sendreturn-system)
8. [Master Bus](#master-bus)
9. [Implementation Order](#implementation-order)

---

## Overview

The Bus Architecture enables Logic Pro-style routing where:
- **Tracks** have instruments (Sampler, future synths) and output to buses
- **Buses** sum multiple track inputs and apply effects
- **Master Bus** is the final output with metering and limiting
- **Sends** allow parallel effects (reverb, delay) without inserting on track

This architecture is essential for the DAW to support the sampler as a "plugin" on a track.

### Design Goals

1. **Flexible routing**: Any track → any bus → master
2. **Effect chains**: Insert effects on buses
3. **Send/Return**: Parallel effects processing
4. **Metering**: VU/Peak meters at key points
5. **Solo/Mute**: Proper signal flow for solo/mute
6. **Low latency**: Minimal audio graph complexity

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DAW SIGNAL FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRACKS (Instruments)                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │   Track 1    │  │   Track 2    │  │   Track 3    │                       │
│  │  [Sampler]   │  │   [Audio]    │  │  [Sampler]   │                       │
│  │              │  │              │  │              │                       │
│  │ Vol: ████░░  │  │ Vol: ██████  │  │ Vol: ███░░░  │                       │
│  │ Pan: ◀──●──▶ │  │ Pan: ◀●────▶ │  │ Pan: ◀────●▶ │                       │
│  │              │  │              │  │              │                       │
│  │ Send 1: 30%  │  │ Send 1: 50%  │  │ Send 1: 0%   │                       │
│  │ Send 2: 0%   │  │ Send 2: 25%  │  │ Send 2: 40%  │                       │
│  │              │  │              │  │              │                       │
│  │ Output: Bus1 │  │ Output: Bus1 │  │ Output: Bus2 │                       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                       │
│         │                 │                 │                                │
│         │    ┌────────────┘                 │                                │
│         │    │                              │                                │
│         ▼    ▼                              ▼                                │
│  ┌───────────────────┐              ┌───────────────────┐                   │
│  │      Bus 1        │              │      Bus 2        │                   │
│  │     (Drums)       │              │     (Synths)      │                   │
│  │                   │              │                   │                   │
│  │ [Compressor]      │              │ [EQ]              │                   │
│  │ [EQ]              │              │ [Saturation]      │                   │
│  │                   │              │                   │                   │
│  │ Vol: █████░       │              │ Vol: ████░░       │                   │
│  └─────────┬─────────┘              └─────────┬─────────┘                   │
│            │                                  │                              │
│            └──────────────┬───────────────────┘                              │
│                           │                                                  │
│  SEND/RETURN              │                                                  │
│  ┌───────────────────┐    │    ┌───────────────────┐                        │
│  │    Return 1       │    │    │    Return 2       │                        │
│  │    (Reverb)       │    │    │    (Delay)        │                        │
│  │                   │    │    │                   │                        │
│  │ [Reverb Plugin]   │    │    │ [Delay Plugin]    │                        │
│  │ 100% wet          │    │    │ 100% wet          │                        │
│  └─────────┬─────────┘    │    └─────────┬─────────┘                        │
│            │              │              │                                   │
│            └──────────────┼──────────────┘                                   │
│                           │                                                  │
│                           ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────┐          │
│  │                        MASTER BUS                              │          │
│  │                                                                │          │
│  │ [Limiter]  [Meter]                                            │          │
│  │                                                                │          │
│  │ Vol: ██████████                                               │          │
│  │                                                                │          │
│  │ Peak L: -3.2dB  Peak R: -2.8dB                                │          │
│  └────────────────────────────────┬──────────────────────────────┘          │
│                                   │                                          │
│                                   ▼                                          │
│                            🔊 AUDIO OUTPUT                                   │
│                        (audioContext.destination)                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Signal Flow

### Track → Bus → Master

```
Track Output
    │
    ├──▶ Track Gain (volume fader)
    │
    ├──▶ Track Pan
    │
    ├──▶ Pre-fader Sends (optional)
    │        │
    │        └──▶ Send 1 Gain ──▶ Return 1 Input
    │        └──▶ Send 2 Gain ──▶ Return 2 Input
    │
    ├──▶ Post-fader Sends (default)
    │        │
    │        └──▶ Send 1 Gain ──▶ Return 1 Input
    │
    └──▶ Output Bus Input
              │
              ▼
         Bus Sum Node
              │
              ├──▶ Bus Effects Chain
              │        │
              │        └──▶ [Effect 1] ──▶ [Effect 2] ──▶ ...
              │
              ├──▶ Bus Gain (bus fader)
              │
              └──▶ Master Bus Input
```

### Solo/Mute Logic

```typescript
// Solo behavior (AFL - After Fader Listen)
function updateSoloMuteState(tracks: Track[], buses: Bus[]): void {
  const anySoloed = tracks.some(t => t.soloed) || buses.some(b => b.soloed)
  
  for (const track of tracks) {
    if (track.muted) {
      track.outputGain.gain.value = 0
    } else if (anySoloed && !track.soloed) {
      track.outputGain.gain.value = 0
    } else {
      track.outputGain.gain.value = track.volume
    }
  }
  
  // Similar for buses
}
```

---

## Type Definitions

**File**: `packages/daw-sdk/src/types/bus.ts`

```typescript
// ============================================================================
// Bus Configuration
// ============================================================================

export interface BusConfig {
  /** Unique bus identifier */
  id: string
  /** Display name */
  name: string
  /** Bus type */
  type: BusType
  /** Color for UI */
  color: string
}

export type BusType = 
  | 'audio'      // Standard summing bus
  | 'aux'        // Auxiliary/send bus (for returns)
  | 'master'     // Master output bus (singleton)
  | 'submix'     // Submix group

// ============================================================================
// Bus State
// ============================================================================

export interface BusState {
  /** Volume (0 to 1, UI shows as dB) */
  volume: number
  /** Pan (-1 to 1) */
  pan: number
  /** Muted */
  muted: boolean
  /** Soloed */
  soloed: boolean
  /** Bypass all effects */
  bypassEffects: boolean
}

export const DEFAULT_BUS_STATE: BusState = {
  volume: 1,
  pan: 0,
  muted: false,
  soloed: false,
  bypassEffects: false,
}

// ============================================================================
// Track Routing
// ============================================================================

export interface TrackRouting {
  /** Output destination bus ID */
  outputBusId: string
  /** Send configurations */
  sends: SendConfig[]
}

export interface SendConfig {
  /** Target return bus ID */
  returnBusId: string
  /** Send level (0 to 1) */
  level: number
  /** Pre or post fader */
  position: 'pre' | 'post'
  /** Send enabled */
  enabled: boolean
}

// ============================================================================
// Effect Chain
// ============================================================================

export interface EffectSlot {
  /** Unique slot ID */
  id: string
  /** Effect type identifier */
  effectType: string
  /** Effect parameters */
  params: Record<string, number | string | boolean>
  /** Bypassed */
  bypassed: boolean
  /** Wet/dry mix (0 to 1) */
  mix: number
}

// ============================================================================
// Metering
// ============================================================================

export interface MeterData {
  /** Peak level in dB */
  peakL: number
  peakR: number
  /** RMS level in dB */
  rmsL: number
  rmsR: number
  /** Clip indicator */
  clippedL: boolean
  clippedR: boolean
}

// ============================================================================
// Bus Events
// ============================================================================

export interface BusEventMap {
  'meter': MeterData
  'solo-change': { busId: string; soloed: boolean }
  'mute-change': { busId: string; muted: boolean }
  'routing-change': { trackId: string; busId: string }
}
```

---

## Bus Class

**File**: `packages/daw-sdk/src/core/bus.ts`

```typescript
import type { BusConfig, BusState, EffectSlot, MeterData } from '../types/bus'

export class Bus extends EventTarget {
  readonly id: string
  readonly type: BusConfig['type']
  
  private audioContext: AudioContext
  private state: BusState
  
  // Audio nodes
  private inputNode: GainNode          // Summing point
  private effectChainInput: GainNode   // Effects bypass switching
  private effectChainOutput: GainNode
  private volumeNode: GainNode         // Main fader
  private panNode: StereoPannerNode
  private outputNode: GainNode         // Final output
  
  // Effects
  private effects: Map<string, EffectSlot> = new Map()
  
  // Metering
  private analyserL: AnalyserNode
  private analyserR: AnalyserNode
  private meterInterval: number | null = null
  
  constructor(
    audioContext: AudioContext,
    config: BusConfig,
    initialState?: Partial<BusState>
  ) {
    super()
    this.audioContext = audioContext
    this.id = config.id
    this.type = config.type
    this.state = { ...DEFAULT_BUS_STATE, ...initialState }
    
    this.createAudioGraph()
    this.startMetering()
  }
  
  // ===========================================================================
  // Audio Graph
  // ===========================================================================
  
  private createAudioGraph(): void {
    // Create nodes
    this.inputNode = this.audioContext.createGain()
    this.effectChainInput = this.audioContext.createGain()
    this.effectChainOutput = this.audioContext.createGain()
    this.volumeNode = this.audioContext.createGain()
    this.panNode = this.audioContext.createStereoPanner()
    this.outputNode = this.audioContext.createGain()
    
    // Create analyzers for metering
    this.analyserL = this.audioContext.createAnalyser()
    this.analyserR = this.audioContext.createAnalyser()
    this.analyserL.fftSize = 256
    this.analyserR.fftSize = 256
    
    // Connect chain (no effects initially)
    // input → effectChainInput → effectChainOutput → volume → pan → output
    this.inputNode.connect(this.effectChainInput)
    this.effectChainInput.connect(this.effectChainOutput)  // Direct bypass
    this.effectChainOutput.connect(this.volumeNode)
    this.volumeNode.connect(this.panNode)
    this.panNode.connect(this.outputNode)
    
    // Split for stereo metering
    const splitter = this.audioContext.createChannelSplitter(2)
    this.outputNode.connect(splitter)
    splitter.connect(this.analyserL, 0)
    splitter.connect(this.analyserR, 1)
    
    // Apply initial state
    this.volumeNode.gain.value = this.state.volume
    this.panNode.pan.value = this.state.pan
  }
  
  // ===========================================================================
  // Connection Points
  // ===========================================================================
  
  /**
   * Get the input node for connecting track outputs
   */
  getInputNode(): AudioNode {
    return this.inputNode
  }
  
  /**
   * Get the output node for connecting to master/other buses
   */
  getOutputNode(): AudioNode {
    return this.outputNode
  }
  
  /**
   * Connect this bus output to a destination
   */
  connect(destination: AudioNode): void {
    this.outputNode.connect(destination)
  }
  
  /**
   * Disconnect from all destinations
   */
  disconnect(): void {
    this.outputNode.disconnect()
    // Re-connect metering
    const splitter = this.audioContext.createChannelSplitter(2)
    this.outputNode.connect(splitter)
    splitter.connect(this.analyserL, 0)
    splitter.connect(this.analyserR, 1)
  }
  
  // ===========================================================================
  // Volume/Pan/Mute/Solo
  // ===========================================================================
  
  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume))
    this.volumeNode.gain.value = this.state.muted ? 0 : this.state.volume
  }
  
  getVolume(): number {
    return this.state.volume
  }
  
  setPan(pan: number): void {
    this.state.pan = Math.max(-1, Math.min(1, pan))
    this.panNode.pan.value = this.state.pan
  }
  
  getPan(): number {
    return this.state.pan
  }
  
  setMuted(muted: boolean): void {
    this.state.muted = muted
    this.volumeNode.gain.value = muted ? 0 : this.state.volume
    this.emit('mute-change', { busId: this.id, muted })
  }
  
  isMuted(): boolean {
    return this.state.muted
  }
  
  setSoloed(soloed: boolean): void {
    this.state.soloed = soloed
    this.emit('solo-change', { busId: this.id, soloed })
  }
  
  isSoloed(): boolean {
    return this.state.soloed
  }
  
  // ===========================================================================
  // Effects Chain
  // ===========================================================================
  
  /**
   * Add effect to chain (future - effects are plugins)
   */
  addEffect(slot: EffectSlot): void {
    this.effects.set(slot.id, slot)
    this.rebuildEffectChain()
  }
  
  removeEffect(slotId: string): void {
    this.effects.delete(slotId)
    this.rebuildEffectChain()
  }
  
  setBypassEffects(bypass: boolean): void {
    this.state.bypassEffects = bypass
    this.rebuildEffectChain()
  }
  
  private rebuildEffectChain(): void {
    // Disconnect current chain
    this.effectChainInput.disconnect()
    
    if (this.state.bypassEffects || this.effects.size === 0) {
      // Bypass: direct connection
      this.effectChainInput.connect(this.effectChainOutput)
    } else {
      // Build chain through effects
      // Future: Create AudioWorklet nodes for each effect
      // For now, just direct connection
      this.effectChainInput.connect(this.effectChainOutput)
    }
  }
  
  // ===========================================================================
  // Metering
  // ===========================================================================
  
  private startMetering(): void {
    const bufferL = new Float32Array(this.analyserL.fftSize)
    const bufferR = new Float32Array(this.analyserR.fftSize)
    
    const measure = () => {
      this.analyserL.getFloatTimeDomainData(bufferL)
      this.analyserR.getFloatTimeDomainData(bufferR)
      
      const peakL = this.calculatePeak(bufferL)
      const peakR = this.calculatePeak(bufferR)
      const rmsL = this.calculateRMS(bufferL)
      const rmsR = this.calculateRMS(bufferR)
      
      const meterData: MeterData = {
        peakL: this.linearToDb(peakL),
        peakR: this.linearToDb(peakR),
        rmsL: this.linearToDb(rmsL),
        rmsR: this.linearToDb(rmsR),
        clippedL: peakL >= 1,
        clippedR: peakR >= 1,
      }
      
      this.emit('meter', meterData)
    }
    
    // Update at 30fps
    this.meterInterval = window.setInterval(measure, 33)
  }
  
  private stopMetering(): void {
    if (this.meterInterval !== null) {
      clearInterval(this.meterInterval)
      this.meterInterval = null
    }
  }
  
  private calculatePeak(buffer: Float32Array): number {
    let peak = 0
    for (let i = 0; i < buffer.length; i++) {
      peak = Math.max(peak, Math.abs(buffer[i]))
    }
    return peak
  }
  
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i]
    }
    return Math.sqrt(sum / buffer.length)
  }
  
  private linearToDb(linear: number): number {
    if (linear <= 0) return -Infinity
    return 20 * Math.log10(linear)
  }
  
  // ===========================================================================
  // Cleanup
  // ===========================================================================
  
  dispose(): void {
    this.stopMetering()
    this.outputNode.disconnect()
    this.inputNode.disconnect()
  }
  
  // ===========================================================================
  // Events
  // ===========================================================================
  
  private emit<K extends keyof BusEventMap>(
    event: K,
    detail: BusEventMap[K]
  ): void {
    this.dispatchEvent(new CustomEvent(event, { detail }))
  }
}
```

---

## Track Routing

### Track Output Configuration

```typescript
class Track {
  private outputBus: Bus | null = null
  private sends: Map<string, { node: GainNode; level: number }> = new Map()
  
  // Instrument output node
  private instrumentOutput: GainNode
  private volumeNode: GainNode
  private panNode: StereoPannerNode
  private postFaderNode: GainNode  // For post-fader sends
  
  constructor(audioContext: AudioContext) {
    this.instrumentOutput = audioContext.createGain()
    this.volumeNode = audioContext.createGain()
    this.panNode = audioContext.createStereoPanner()
    this.postFaderNode = audioContext.createGain()
    
    // Chain: instrument → volume → pan → postFader → output
    this.instrumentOutput.connect(this.volumeNode)
    this.volumeNode.connect(this.panNode)
    this.panNode.connect(this.postFaderNode)
  }
  
  /**
   * Set the output bus for this track
   */
  setOutputBus(bus: Bus): void {
    // Disconnect from previous bus
    if (this.outputBus) {
      this.postFaderNode.disconnect()
    }
    
    // Connect to new bus
    this.outputBus = bus
    this.postFaderNode.connect(bus.getInputNode())
  }
  
  /**
   * Add a send to a return bus
   */
  addSend(returnBus: Bus, level: number, position: 'pre' | 'post'): void {
    const sendGain = this.audioContext.createGain()
    sendGain.gain.value = level
    
    // Connect from appropriate point
    if (position === 'pre') {
      this.instrumentOutput.connect(sendGain)
    } else {
      this.postFaderNode.connect(sendGain)
    }
    
    sendGain.connect(returnBus.getInputNode())
    
    this.sends.set(returnBus.id, { node: sendGain, level })
  }
  
  /**
   * Update send level
   */
  setSendLevel(returnBusId: string, level: number): void {
    const send = this.sends.get(returnBusId)
    if (send) {
      send.level = level
      send.node.gain.value = level
    }
  }
  
  /**
   * Get the input node for instrument connection
   */
  getInstrumentInput(): AudioNode {
    return this.instrumentOutput
  }
}
```

---

## Send/Return System

### Return Bus (Aux)

Return buses are special buses that receive send signals:

```typescript
class ReturnBus extends Bus {
  constructor(audioContext: AudioContext, id: string, name: string) {
    super(audioContext, {
      id,
      name,
      type: 'aux',
      color: '#10b981',
    })
  }
  
  // Returns typically have 100% wet effects
  // The dry signal goes through the main bus path
}
```

### Common Send/Return Setup

```typescript
function setupStandardSends(
  audioContext: AudioContext,
  masterBus: Bus
): { reverb: ReturnBus; delay: ReturnBus } {
  // Create return buses
  const reverbReturn = new ReturnBus(audioContext, 'return-reverb', 'Reverb')
  const delayReturn = new ReturnBus(audioContext, 'return-delay', 'Delay')
  
  // Connect returns to master
  reverbReturn.connect(masterBus.getInputNode())
  delayReturn.connect(masterBus.getInputNode())
  
  // TODO: Add reverb/delay effects to returns
  
  return { reverb: reverbReturn, delay: delayReturn }
}
```

---

## Master Bus

### Master Bus Singleton

```typescript
class MasterBus extends Bus {
  private limiter: DynamicsCompressorNode
  
  constructor(audioContext: AudioContext) {
    super(audioContext, {
      id: 'master',
      name: 'Master',
      type: 'master',
      color: '#ef4444',
    })
    
    // Add limiter before output
    this.limiter = audioContext.createDynamicsCompressor()
    this.limiter.threshold.value = -1
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.001
    this.limiter.release.value = 0.1
    
    // Insert limiter before final output
    // ... (modify audio graph)
    
    // Connect to destination
    this.connect(audioContext.destination)
  }
  
  /**
   * Get current output levels for main meter
   */
  getOutputLevels(): MeterData {
    // Use inherited metering
    return this.getCurrentMeterData()
  }
}
```

---

## Implementation Order

### Phase 1: Basic Routing (MVP)
- [ ] `types/bus.ts` - Type definitions
- [ ] `core/bus.ts` - Basic Bus class
- [ ] Track output → Bus connection
- [ ] Bus → Master connection
- [ ] Master → destination

### Phase 2: Sends & Returns
- [ ] Pre/post fader send routing
- [ ] Return bus (aux) support
- [ ] Default reverb/delay returns

### Phase 3: Metering
- [ ] Peak/RMS metering
- [ ] Clip detection
- [ ] Meter UI components

### Phase 4: Effects
- [ ] Effect slot system
- [ ] Effect bypass
- [ ] Built-in effects (EQ, Compressor, Limiter)

---

## File Structure

```
packages/daw-sdk/src/
├── types/
│   ├── bus.ts              # NEW - Bus type definitions
│   └── index.ts            # UPDATE - export bus types
├── core/
│   ├── bus.ts              # NEW - Bus class
│   ├── master-bus.ts       # NEW - Master bus singleton
│   ├── return-bus.ts       # NEW - Return/aux bus
│   └── index.ts            # UPDATE - exports
```

---

## Related Plans

- [Sampler Engine](./sampler_engine.plan.md) - Instrument that outputs to bus
- [Voice Management](./voice_management.plan.md) - Voice output routing
- [MIDI Integration](../midi_integration.plan.md) - MIDI → Sampler → Bus
