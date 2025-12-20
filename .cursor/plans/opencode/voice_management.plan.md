# Voice Management System Plan

> **Created**: 2025-01-20
> **Status**: Planning
> **Package**: `packages/daw-sdk`
> **Related**: [sampler_engine.plan.md](./sampler_engine.plan.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Voice Lifecycle](#voice-lifecycle)
3. [Voice Pool Architecture](#voice-pool-architecture)
4. [Voice Stealing Algorithms](#voice-stealing-algorithms)
5. [Polyphony Management](#polyphony-management)
6. [Implementation Details](#implementation-details)
7. [Performance Considerations](#performance-considerations)

---

## Overview

Voice management handles the allocation, tracking, and recycling of audio voices in the sampler. A "voice" represents a single playing instance of a sample, including its audio nodes and envelope state.

### Key Constraints

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max voices | 32 | Desktop-focused, sufficient for most use cases |
| Default voices | 4 | Conservative start, prevents CPU overload |
| Min voices | 1 | Monophonic mode support |
| Steal fade time | 5ms | Quick but click-free |

### Design Goals

1. **Predictable behavior**: Same input always produces same output
2. **Musical priority**: Preserve notes that matter (loud, recent)
3. **Click-free**: All voice transitions use short fades
4. **Low latency**: Voice acquisition < 1ms
5. **Memory efficient**: Reuse voice objects, don't allocate during playback

---

## Voice Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VOICE STATE MACHINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│     ┌──────────┐                                                            │
│     │   IDLE   │◄─────────────────────────────────────────────┐             │
│     │ (pool)   │                                               │             │
│     └────┬─────┘                                               │             │
│          │ triggerAttack()                                     │             │
│          ▼                                                     │             │
│     ┌──────────┐    attack ends    ┌──────────┐               │             │
│     │  ATTACK  │──────────────────▶│  DECAY   │               │             │
│     │ (ramp up)│                   │(ramp down)│               │             │
│     └────┬─────┘                   └────┬─────┘               │             │
│          │                              │                      │             │
│          │ triggerRelease()             │ decay ends           │             │
│          │ (if gate mode)               ▼                      │             │
│          │                         ┌──────────┐               │             │
│          │                         │ SUSTAIN  │               │             │
│          │                         │ (hold)   │               │             │
│          │                         └────┬─────┘               │             │
│          │                              │ triggerRelease()     │             │
│          │                              │ OR sample ends       │             │
│          ▼                              ▼                      │             │
│     ┌─────────────────────────────────────┐                   │             │
│     │             RELEASE                  │                   │             │
│     │           (fade out)                 │                   │             │
│     └────────────────┬────────────────────┘                   │             │
│                      │ release ends                            │             │
│                      ▼                                         │             │
│     ┌──────────────────────────────────────┐                  │             │
│     │            FINISHED                   │──────────────────┘             │
│     │         (cleanup)                     │     recycle to IDLE            │
│     └──────────────────────────────────────┘                                 │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│     VOICE STEALING (can happen from any active state):                       │
│                                                                              │
│     [ATTACK/DECAY/SUSTAIN] ──▶ quickFadeOut() ──▶ [FINISHED] ──▶ [IDLE]     │
│                                   (5ms)                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### State Transitions

| From | To | Trigger | Duration |
|------|-----|---------|----------|
| IDLE | ATTACK | `triggerAttack()` | Instant |
| ATTACK | DECAY | Attack time elapsed | `envelope.attack` ms |
| ATTACK | RELEASE | `triggerRelease()` (gate mode) | Instant |
| DECAY | SUSTAIN | Decay time elapsed | `envelope.decay` ms |
| DECAY | RELEASE | `triggerRelease()` | Instant |
| SUSTAIN | RELEASE | `triggerRelease()` OR sample ends | Instant |
| RELEASE | FINISHED | Release time elapsed | `envelope.release` ms |
| FINISHED | IDLE | Cleanup complete | Instant |
| ANY | FINISHED | Voice stolen | 5ms fade |

---

## Voice Pool Architecture

### Pre-allocation Strategy

```typescript
class VoicePool {
  private voices: Voice[] = []
  private maxSize: number
  private activeSize: number
  
  constructor(maxSize: number, defaultSize: number) {
    this.maxSize = maxSize
    this.activeSize = defaultSize
    
    // Pre-allocate all voice objects (but not audio nodes)
    for (let i = 0; i < maxSize; i++) {
      this.voices.push(this.createVoiceObject(i))
    }
  }
  
  private createVoiceObject(index: number): Voice {
    return {
      id: `voice-${index}`,
      padId: '',
      note: 0,
      velocity: 0,
      state: 'idle',
      startTime: 0,
      releaseStartTime: undefined,
      sourceNode: null,
      gainNode: null,
      pannerNode: null,
    }
  }
  
  /**
   * Get an available voice from the pool
   * Returns null if no voices available and stealing is disabled
   */
  acquire(): Voice | null {
    // First pass: find idle/finished voice
    for (let i = 0; i < this.activeSize; i++) {
      const voice = this.voices[i]
      if (voice.state === 'idle' || voice.state === 'finished') {
        return voice
      }
    }
    return null  // Caller must handle stealing
  }
  
  /**
   * Return a voice to the pool
   */
  release(voice: Voice): void {
    // Disconnect and cleanup audio nodes
    this.cleanupVoiceNodes(voice)
    
    // Reset state
    voice.state = 'idle'
    voice.padId = ''
    voice.note = 0
    voice.velocity = 0
    voice.startTime = 0
    voice.releaseStartTime = undefined
  }
  
  private cleanupVoiceNodes(voice: Voice): void {
    if (voice.sourceNode) {
      try {
        voice.sourceNode.stop()
        voice.sourceNode.disconnect()
      } catch (e) {
        // Source may already be stopped
      }
      voice.sourceNode = null
    }
    
    if (voice.gainNode) {
      voice.gainNode.disconnect()
      voice.gainNode = null
    }
    
    if (voice.pannerNode) {
      voice.pannerNode.disconnect()
      voice.pannerNode = null
    }
  }
  
  /**
   * Get all active (non-idle) voices
   */
  getActive(): Voice[] {
    return this.voices
      .slice(0, this.activeSize)
      .filter(v => v.state !== 'idle' && v.state !== 'finished')
  }
  
  /**
   * Change active pool size (up to max)
   */
  setActiveSize(size: number): void {
    this.activeSize = Math.min(size, this.maxSize)
    
    // If reducing size, stop excess voices
    for (let i = this.activeSize; i < this.voices.length; i++) {
      const voice = this.voices[i]
      if (voice.state !== 'idle') {
        this.quickFadeAndRelease(voice)
      }
    }
  }
}
```

### Memory Layout

```
Voice Pool (32 max, 4 active by default):
┌────────────────────────────────────────────────────────────────┐
│  [0]    [1]    [2]    [3]  │  [4]    [5]   ...  [31]          │
│  ▲──────────────────────▲  │  ▲──────────────────────▲        │
│      ACTIVE VOICES          │      RESERVED (not used)         │
│     (can be acquired)       │     (until activeSize increases) │
└────────────────────────────────────────────────────────────────┘
```

---

## Voice Stealing Algorithms

### Priority System (First Principles)

When all voices are in use and a new note arrives, we must decide which voice to steal. The algorithm should:

1. **Preserve audible notes** - Don't steal loud, prominent notes
2. **Prefer dying notes** - Notes already releasing are less important
3. **Be predictable** - Same situation = same decision
4. **Be fast** - O(n) where n = active voices

### Algorithm: Release → Oldest → Quietest

```typescript
type StealingMode = 'oldest' | 'lowest-velocity' | 'same-note' | 'none'

interface StealingConfig {
  mode: StealingMode
  fadeOutMs: number
  preferReleasing: boolean
}

function selectVictim(
  candidates: Voice[],
  config: StealingConfig,
  incomingNote: number
): Voice | null {
  if (config.mode === 'none') return null
  if (candidates.length === 0) return null
  
  // Step 1: Prefer voices already in release state
  if (config.preferReleasing) {
    const releasing = candidates.filter(v => v.state === 'release')
    if (releasing.length > 0) {
      // Among releasing voices, pick the oldest
      return releasing.reduce((oldest, v) => 
        v.releaseStartTime! < oldest.releaseStartTime! ? v : oldest
      )
    }
  }
  
  // Step 2: Apply mode-specific selection
  switch (config.mode) {
    case 'oldest':
      // First-In-First-Out: steal the voice that's been playing longest
      return candidates.reduce((oldest, v) => 
        v.startTime < oldest.startTime ? v : oldest
      )
    
    case 'lowest-velocity':
      // Steal the quietest voice (lowest velocity = least prominent)
      return candidates.reduce((quietest, v) => 
        v.velocity < quietest.velocity ? v : quietest
      )
    
    case 'same-note':
      // Only steal if same note (retrigger behavior)
      const sameNote = candidates.find(v => v.note === incomingNote)
      return sameNote || null
    
    default:
      return null
  }
}
```

### Detailed Algorithm Comparison

| Mode | Best For | Behavior |
|------|----------|----------|
| `oldest` | General use | FIFO, predictable, preserves recent notes |
| `lowest-velocity` | Expressive playing | Preserves loud notes, steals soft notes |
| `same-note` | Monosynth/retrigger | Only replaces same pitch, rejects if different |
| `none` | Full polyphony | Never steals, rejects new notes when full |

### Quick Fade Implementation

```typescript
function quickFadeOut(
  voice: Voice, 
  fadeMs: number,
  audioContext: AudioContext,
  onComplete: () => void
): void {
  if (!voice.gainNode) {
    onComplete()
    return
  }
  
  const now = audioContext.currentTime
  const fadeTime = fadeMs / 1000
  const currentGain = voice.gainNode.gain.value
  
  // Cancel any scheduled automation
  voice.gainNode.gain.cancelScheduledValues(now)
  voice.gainNode.gain.setValueAtTime(currentGain, now)
  
  // Linear fade to 0
  voice.gainNode.gain.linearRampToValueAtTime(0, now + fadeTime)
  
  // Schedule cleanup
  setTimeout(() => {
    onComplete()
  }, fadeMs + 1)  // +1ms buffer
}
```

### Edge Cases

#### 1. All voices releasing
If all voices are already releasing, pick the one closest to finishing:

```typescript
function selectFromReleasing(voices: Voice[]): Voice {
  // Calculate remaining release time for each
  return voices.reduce((nearest, v) => {
    const elapsed = audioContext.currentTime - v.releaseStartTime!
    const pad = getPad(v.padId)
    const remaining = (pad.envelope.release / 1000) - elapsed
    
    const nearestElapsed = audioContext.currentTime - nearest.releaseStartTime!
    const nearestPad = getPad(nearest.padId)
    const nearestRemaining = (nearestPad.envelope.release / 1000) - nearestElapsed
    
    return remaining < nearestRemaining ? v : nearest
  })
}
```

#### 2. Tie-breaking
When multiple voices have same priority (e.g., same velocity), use voice index as tiebreaker:

```typescript
function tieBreak(a: Voice, b: Voice): Voice {
  // Lower index = older in pool = steal first
  const indexA = parseInt(a.id.split('-')[1])
  const indexB = parseInt(b.id.split('-')[1])
  return indexA < indexB ? a : b
}
```

#### 3. Same-note retrigger
When the same note is triggered while already playing:

```typescript
function handleRetrigger(
  existingVoice: Voice,
  velocity: number,
  mode: 'restart' | 'legato' | 'ignore'
): void {
  switch (mode) {
    case 'restart':
      // Quick fade existing, start new
      quickFadeOut(existingVoice, 5, audioContext, () => {
        startNewVoice(existingVoice.note, velocity)
      })
      break
    
    case 'legato':
      // Keep playing, just update velocity
      existingVoice.velocity = velocity
      // Optionally restart envelope
      break
    
    case 'ignore':
      // Do nothing, let existing voice continue
      break
  }
}
```

---

## Polyphony Management

### Dynamic Polyphony

```typescript
class PolyphonyManager {
  private currentLimit: number
  private maxLimit: number
  private autoManage: boolean
  
  constructor(defaultLimit: number, maxLimit: number) {
    this.currentLimit = defaultLimit
    this.maxLimit = maxLimit
    this.autoManage = false
  }
  
  /**
   * Set polyphony limit
   * @param count - Number of simultaneous voices (1-32)
   */
  setLimit(count: number): void {
    this.currentLimit = Math.max(1, Math.min(count, this.maxLimit))
  }
  
  /**
   * Enable auto-management based on CPU usage
   */
  enableAutoManage(targetCpuPercent: number = 50): void {
    this.autoManage = true
    // Monitor AudioContext.baseLatency and adjust limit
  }
  
  /**
   * Get current effective limit
   */
  getLimit(): number {
    return this.currentLimit
  }
}
```

### Polyphony Modes

| Mode | Voices | Use Case |
|------|--------|----------|
| Mono | 1 | Bass synths, leads |
| Duo | 2 | Intervals, simple chords |
| Quad | 4 | Basic chords (default) |
| Octo | 8 | Full chords |
| Full | 32 | Piano, orchestral |

### Per-Pad Polyphony

Some pads may want limited polyphony (e.g., hi-hat choke):

```typescript
interface PadPolyphony {
  /** Max voices for this pad (0 = use global) */
  maxVoices: number
  /** Choke group - pads in same group stop each other */
  chokeGroup?: string
}

// Example: Hi-hat choke
openHiHat.chokeGroup = 'hihat'
closedHiHat.chokeGroup = 'hihat'

// When closed hi-hat triggers, stop open hi-hat
function handleChokeGroup(pad: SamplerPad): void {
  if (!pad.chokeGroup) return
  
  for (const voice of activeVoices) {
    const voicePad = getPad(voice.padId)
    if (voicePad.chokeGroup === pad.chokeGroup && voicePad.id !== pad.id) {
      quickFadeOut(voice, 5, audioContext, () => recycleVoice(voice))
    }
  }
}
```

---

## Implementation Details

### Voice Initialization

```typescript
function initializeVoice(
  voice: Voice,
  pad: SamplerPad,
  note: number,
  velocity: number,
  audioContext: AudioContext
): void {
  // Set voice properties
  voice.padId = pad.id
  voice.note = note
  voice.velocity = velocity
  voice.state = 'attack'
  voice.startTime = audioContext.currentTime
  voice.releaseStartTime = undefined
  
  // Create audio nodes
  voice.sourceNode = audioContext.createBufferSource()
  voice.sourceNode.buffer = pad.audioBuffer
  
  voice.gainNode = audioContext.createGain()
  voice.gainNode.gain.value = 0  // Start at 0 for attack
  
  voice.pannerNode = audioContext.createStereoPanner()
  voice.pannerNode.pan.value = pad.pan
  
  // Connect: source → gain → panner → output
  voice.sourceNode.connect(voice.gainNode)
  voice.gainNode.connect(voice.pannerNode)
  voice.pannerNode.connect(samplerOutput)
  
  // Apply pitch shift
  const pitchRate = Math.pow(2, (pad.pitchShift + pad.fineTune / 100) / 12)
  voice.sourceNode.playbackRate.value = pitchRate
  
  // Handle reverse
  if (pad.reverse) {
    // Reverse buffer playback
    voice.sourceNode.playbackRate.value *= -1
    // Start from end
  }
  
  // Handle loop
  if (pad.loop.enabled) {
    voice.sourceNode.loop = true
    voice.sourceNode.loopStart = pad.loop.start * pad.audioBuffer!.duration
    voice.sourceNode.loopEnd = pad.loop.end * pad.audioBuffer!.duration
  }
  
  // Set up end handler
  voice.sourceNode.onended = () => {
    if (voice.state !== 'release') {
      // Sample ended naturally (one-shot or end of loop)
      voice.state = 'finished'
      recycleVoice(voice)
    }
  }
}
```

### State Tracking

```typescript
class VoiceStateTracker {
  private voiceStates: Map<string, VoiceState> = new Map()
  private stateChangeCallbacks: ((voiceId: string, state: VoiceState) => void)[] = []
  
  setState(voiceId: string, state: VoiceState): void {
    const prevState = this.voiceStates.get(voiceId)
    this.voiceStates.set(voiceId, state)
    
    // Notify listeners
    for (const callback of this.stateChangeCallbacks) {
      callback(voiceId, state)
    }
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Voice ${voiceId}: ${prevState} → ${state}`)
    }
  }
  
  getState(voiceId: string): VoiceState {
    return this.voiceStates.get(voiceId) || 'idle'
  }
  
  onStateChange(callback: (voiceId: string, state: VoiceState) => void): void {
    this.stateChangeCallbacks.push(callback)
  }
}
```

---

## Performance Considerations

### CPU Budget

| Operation | Target Time | Notes |
|-----------|-------------|-------|
| Voice acquisition | < 0.5ms | No allocation in hot path |
| Steal selection | < 0.1ms | O(n) where n ≤ 32 |
| Node creation | < 1ms | Amortized via pooling |
| ADSR scheduling | < 0.5ms | Use native Web Audio when possible |

### Memory Management

```typescript
// DON'T: Allocate during playback
function bad_triggerAttack(note: number, velocity: number): void {
  const voice = new Voice()  // BAD: allocation
  voices.push(voice)         // BAD: array growth
}

// DO: Pre-allocate and reuse
function good_triggerAttack(note: number, velocity: number): void {
  const voice = voicePool.acquire()  // GOOD: reuse existing
  if (!voice) return
  initializeVoice(voice, ...)
}
```

### Audio Node Recycling

```typescript
// Option 1: Recreate nodes each time (simpler, slightly more CPU)
function createVoiceNodes(voice: Voice, pad: SamplerPad): void {
  voice.sourceNode = audioContext.createBufferSource()
  voice.gainNode = audioContext.createGain()
  voice.pannerNode = audioContext.createStereoPanner()
  // ... connect
}

// Option 2: Reuse gain/panner, only recreate source (more complex)
function reuseVoiceNodes(voice: Voice, pad: SamplerPad): void {
  // Source must be recreated (can't restart)
  voice.sourceNode = audioContext.createBufferSource()
  
  // Reuse existing gain/panner if available
  if (!voice.gainNode) {
    voice.gainNode = audioContext.createGain()
  }
  // ... reconnect source
}

// Recommendation: Option 1 for simplicity. 
// GainNode/StereoPannerNode creation is fast.
```

### Scheduling Precision

```typescript
// Use AudioContext.currentTime for precise timing
function scheduleRelease(voice: Voice, releaseTime: number): void {
  const now = audioContext.currentTime
  const releaseAt = now + releaseTime
  
  // Schedule gain automation
  voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now)
  voice.gainNode.gain.linearRampToValueAtTime(0, releaseAt)
  
  // Schedule source stop (slightly after gain reaches 0)
  voice.sourceNode.stop(releaseAt + 0.01)
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('VoicePool', () => {
  it('should acquire idle voices', () => {
    const pool = new VoicePool(32, 4)
    const voice = pool.acquire()
    expect(voice).not.toBeNull()
    expect(voice.state).toBe('idle')
  })
  
  it('should return null when pool exhausted', () => {
    const pool = new VoicePool(32, 2)
    pool.acquire()
    pool.acquire()
    expect(pool.acquire()).toBeNull()
  })
})

describe('Voice Stealing', () => {
  it('should prefer releasing voices', () => {
    const candidates = [
      { state: 'sustain', startTime: 0, velocity: 100 },
      { state: 'release', startTime: 1, velocity: 50 },
    ]
    const victim = selectVictim(candidates, { preferReleasing: true })
    expect(victim.state).toBe('release')
  })
  
  it('should select oldest in oldest mode', () => {
    const candidates = [
      { state: 'sustain', startTime: 100, velocity: 50 },
      { state: 'sustain', startTime: 50, velocity: 100 },
    ]
    const victim = selectVictim(candidates, { mode: 'oldest' })
    expect(victim.startTime).toBe(50)
  })
})
```

### Integration Tests

```typescript
describe('SamplerEngine Voice Management', () => {
  it('should trigger and release voices correctly', async () => {
    const sampler = new SamplerEngine(audioContext, { defaultVoices: 4 })
    await sampler.loadSample('pad-0', testBuffer)
    
    const voiceId = sampler.triggerAttack(36, 100)
    expect(voiceId).not.toBeNull()
    expect(sampler.getActiveVoices().length).toBe(1)
    
    sampler.triggerRelease(36)
    // Wait for release
    await sleep(100)
    expect(sampler.getActiveVoices().length).toBe(0)
  })
  
  it('should steal voices when pool exhausted', async () => {
    const sampler = new SamplerEngine(audioContext, { defaultVoices: 2 })
    await sampler.loadSample('pad-0', testBuffer)
    
    sampler.triggerAttack(36, 100)
    sampler.triggerAttack(37, 100)
    
    // Third note should steal
    const events: any[] = []
    sampler.addEventListener('voice:stolen', (e) => events.push(e.detail))
    
    sampler.triggerAttack(38, 100)
    
    expect(events.length).toBe(1)
    expect(sampler.getActiveVoices().length).toBe(2)
  })
})
```

---

## Related Plans

- [Sampler Engine](./sampler_engine.plan.md) - Parent component
- [Bus Architecture](./bus_architecture.plan.md) - Output routing
