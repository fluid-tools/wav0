# WAV0 MIDI Integration Plan

> **Created**: 2025-01-19

> **Updated**: 2025-01-20

> **Status**: Phase 1 & 2 Complete, Phase 3 Next

> **Estimated Total Lines**: ~2,800

---

## Related Plans

This plan is part of a larger architecture. See also:

- [Sampler Engine](./opencode/sampler_engine.plan.md) - Sample playback with MIDI trigger
- [Voice Management](./opencode/voice_management.plan.md) - Polyphony and voice stealing
- [Bus Architecture](./opencode/bus_architecture.plan.md) - Track/bus routing for DAW integration

---

## Overall Trajectory

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROJECT PHASES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ COMPLETE: MIDI Foundation (Phase 1-2)                                    │
│  ├── types/midi.ts         - MIDI types & events (310 lines)                │
│  ├── core/midi-service.ts  - Web MIDI API wrapper (387 lines)               │
│  ├── utils/quantization.ts - Grid snapping (251 lines)                      │
│  └── utils/midi-time.ts    - Tick/time conversions (298 lines)              │
│                                                                              │
│  🔜 NEXT: Core Engine                                                        │
│  ├── core/midi-player.ts   - Timer-based MIDI scheduler (~350 lines)        │
│  ├── types/sampler.ts      - Sampler types (~150 lines)                     │
│  ├── core/sampler-engine.ts - Sample playback + voice mgmt (~500 lines)     │
│  └── core/recording-service.ts - Mic input → sample (~150 lines)            │
│                                                                              │
│  📋 THEN: Integration                                                        │
│  ├── core/midi-learn.ts    - CC → parameter mapping (~200 lines)            │
│  ├── types/bus.ts          - Bus/routing types (~100 lines)                 │
│  ├── core/bus.ts           - Audio bus class (~300 lines)                   │
│  ├── atoms/midi.ts         - Jotai state (~100 lines)                       │
│  └── hooks/use-*.ts        - React hooks (~250 lines)                       │
│                                                                              │
│  🎨 FINALLY: UI + Routes                                                     │
│  ├── /sampler route        - Standalone sampler app                         │
│  ├── Virtual keyboard      - Piano/pad interface                            │
│  ├── DAW track integration - Sampler as instrument on track                 │
│  └── Piano roll/drum grid  - MIDI editing UI                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Design Decisions](#design-decisions)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Core MIDI Types & Service](#phase-1-core-midi-types--service) ✅
4. [Phase 2: Quantization & Time Utilities](#phase-2-quantization--time-utilities) ✅
5. [Phase 3: MIDI Player (Scheduler)](#phase-3-midi-player-scheduler)
6. [Phase 4: MIDI File I/O](#phase-4-midi-file-io) (Deferred)
7. [Phase 5: MIDI Learn System](#phase-5-midi-learn-system)
8. [Phase 6: React Integration](#phase-6-react-integration)
9. [Phase 7: UI Components](#phase-7-ui-components)
10. [Implementation Status](#implementation-status)
11. [File Summary](#file-summary)

---

## Design Decisions

| Decision | Choice | Rationale |

|----------|--------|-----------|

| MIDI API | Direct Web MIDI API | Zero dependencies, fits MediaBunny philosophy |

| Safari fallback | On-screen keyboard + UI message | Service workers cannot access MIDI API (main-thread only) |

| Timebase | 960 PPQ default (with 480 toggle) | Higher precision for modern web; toggle for compatibility |

| Region editor | Piano roll + drum grid (toggle) | Logic Pro-style flexibility |

| MIDI direction | Input only (MVP) | Sampler/sequencer use case |

| Player architecture | Separate `MIDIPlayer` class | Cleaner separation from audio `Transport` |

| MIDI learn | Any parameter mappable | Real-time CC mapping (Logic Pro standard) |

| State management | Jotai atoms in daw-react | Consistent with existing architecture |

| Curve system | Reuse existing `-99 to +99` curves | `packages/daw-sdk/src/utils/curves.ts` already exists |---

## Architecture Overview

```javascript
┌─────────────────────────────────────────────────────────────────────────────┐
│                         packages/daw-sdk/src/                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐     ┌─────────────────────┐                       │
│  │ core/midi-service.ts│     │ core/midi-player.ts │                       │
│  │ ─────────────────── │     │ ─────────────────── │                       │
│  │ • Web MIDI API      │     │ • Timer-based loop  │                       │
│  │ • Device enum       │────▶│ • Tick scheduling   │                       │
│  │ • Event parsing     │     │ • Lookahead buffer  │                       │
│  │ • Hot-plug support  │     │ • Tempo sync        │                       │
│  └─────────────────────┘     └──────────┬──────────┘                       │
│           │                             │                                   │
│           ▼                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      types/midi.ts                                   │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ MIDINoteData | MIDIControllerData | MIDIPitchBendData | MIDITrack   │   │
│  │ MIDIRegion | MIDIDeviceInfo | QuantizeGrid | MIDILearnBinding       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────┐     ┌─────────────────────┐                       │
│  │ utils/quantization.ts│    │ utils/midi-time.ts  │                       │
│  │ ─────────────────── │     │ ─────────────────── │                       │
│  │ • Grid snapping     │     │ • Tick ↔ ms         │                       │
│  │ • Strength %        │     │ • Tick ↔ beats      │                       │
│  │ • Triplets/dotted   │     │ • BBT formatting    │                       │
│  │ • Swing             │     │ • Note name ↔ num   │                       │
│  └─────────────────────┘     └─────────────────────┘                       │
│                                                                             │
│  ┌─────────────────────┐                                                   │
│  │ core/midi-learn.ts  │                                                   │
│  │ ─────────────────── │                                                   │
│  │ • CC → param map    │                                                   │
│  │ • Learn mode        │                                                   │
│  │ • Value scaling     │                                                   │
│  └─────────────────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       packages/daw-react/src/                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐     ┌─────────────────────┐                       │
│  │ atoms/midi.ts       │     │ hooks/use-midi.ts   │                       │
│  │ ─────────────────── │     │ ─────────────────── │                       │
│  │ • midiEnabledAtom   │     │ • useMIDIDevices()  │                       │
│  │ • midiInputsAtom    │     │ • useMIDINotes()    │                       │
│  │ • quantizeGridAtom  │     │ • useMIDILearn()    │                       │
│  │ • midiLearnAtom     │     │ • useQuantize()     │                       │
│  └─────────────────────┘     └─────────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    apps/web/components/daw/                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐     ┌─────────────────────┐                       │
│  │ virtual-keyboard.tsx│     │ midi-region-editor/ │                       │
│  │ ─────────────────── │     │ ─────────────────── │                       │
│  │ • Piano layout      │     │ • piano-roll.tsx    │                       │
│  │ • Pad grid layout   │     │ • drum-grid.tsx     │                       │
│  │ • Touch velocity    │     │ • quantize-bar.tsx  │                       │
│  │ • Safari fallback   │     │ • note-inspector.tsx│                       │
│  └─────────────────────┘     └─────────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core MIDI Types & Service

**Status**: Ready for implementation

**Estimated Lines**: ~450

**Dependencies**: None

### 1.1 MIDI Types

**File**: `packages/daw-sdk/src/types/midi.ts`

**Lines**: ~200This file defines all MIDI-related TypeScript types used throughout the system.

#### Type Categories

1. **Timebase Configuration**

- `MIDITimebase`: 480 | 960 PPQ
- `DEFAULT_TIMEBASE`: 960

2. **Device Types**

- `MIDIDeviceInfo`: Device metadata (id, name, manufacturer, state)

3. **Real-time Input Events** (from hardware)

- `MIDINoteOnEvent`: Note-on with velocity
- `MIDINoteOffEvent`: Note-off with release velocity
- `MIDIControlChangeEvent`: CC messages
- `MIDIPitchBendEvent`: Pitch wheel (-8192 to +8191)
- `MIDIInputEvent`: Union type

4. **Stored MIDI Data** (for tracks/regions)

- `MIDINoteData`: Note with tick position and duration
- `MIDIControllerData`: CC data point
- `MIDIPitchBendData`: Pitch bend data point
- `MIDITempoEvent`: Tempo change
- `MIDITimeSignatureEvent`: Time signature change

5. **MIDI Track & Region**

- `MIDITrack`: Container for MIDI data
- `MIDIRegion`: Clip on timeline referencing a track

6. **MIDI Learn**

- `MIDILearnBinding`: CC → parameter mapping

7. **Quantization**

- `QuantizeGrid`: Grid values including triplets and dotted
- `QuantizeSettings`: Grid + strength + swing

8. **Constants**

- `MIDI_CC`: Common CC numbers (mod wheel, sustain, etc.)

### 1.2 MIDI Service

**File**: `packages/daw-sdk/src/core/midi-service.ts`

**Lines**: ~250Web MIDI API wrapper with EventTarget pattern for reactive updates.

#### Class: `MIDIService`

```typescript
class MIDIService extends EventTarget {
  // Static
  static isSupported(): boolean

  // Lifecycle
  enable(): Promise<void>
  disable(): void
  isEnabled(): boolean

  // Devices
  getInputs(): MIDIDeviceInfo[]
  connectInput(deviceId: string): void
  disconnectInput(deviceId: string): void
  disconnectAll(): void
  getConnectedInputIds(): string[]

  // Channel
  setChannelFilter(channel: number | 'all'): void
  getChannelFilter(): number | 'all'
}

// Events emitted via EventTarget:
// - 'noteon': CustomEvent<MIDINoteOnEvent>
// - 'noteoff': CustomEvent<MIDINoteOffEvent>
// - 'controlchange': CustomEvent<MIDIControlChangeEvent>
// - 'pitchbend': CustomEvent<MIDIPitchBendEvent>
// - 'devicechange': CustomEvent<{ inputs: MIDIDeviceInfo[] }>
```

#### MIDI Message Parsing

- Status byte decoding: `0x90` (note on), `0x80` (note off), `0xB0` (CC), `0xE0` (pitch bend)
- Channel extraction: `status & 0x0F`
- Velocity 0 on note-on treated as note-off (per MIDI spec)
- Pitch bend: 14-bit value from LSB + MSB, centered at 8192

### 1.3 Export Updates

**File**: `packages/daw-sdk/src/types/index.ts`Add: `export * from "./midi"`**File**: `packages/daw-sdk/src/index.ts`Ensure MIDI types are exported from main entry.---

## Phase 2: Quantization & Time Utilities

**Status**: Ready for implementation

**Estimated Lines**: ~280

**Dependencies**: Phase 1 types

### 2.1 Quantization Utilities

**File**: `packages/daw-sdk/src/utils/quantization.ts`

**Lines**: ~150Grid-based quantization for MIDI notes.

#### Grid Definitions (at 960 PPQ)

| Grid | Ticks | Description |

|------|-------|-------------|

| 1/1 | 3840 | Whole note |

| 1/2 | 1920 | Half note |

| 1/4 | 960 | Quarter note |

| 1/8 | 480 | Eighth note |

| 1/16 | 240 | Sixteenth note |

| 1/32 | 120 | Thirty-second note |

| 1/64 | 60 | Sixty-fourth note |

| 1/4T | 640 | Quarter triplet (960 × 2/3) |

| 1/8T | 320 | Eighth triplet |

| 1/16T | 160 | Sixteenth triplet |

| 1/32T | 80 | Thirty-second triplet |

| 1/4D | 1440 | Dotted quarter (960 × 1.5) |

| 1/8D | 720 | Dotted eighth |

| 1/16D | 360 | Dotted sixteenth |

#### Functions

```typescript
export const quantization = {
  // Get grid size in ticks
  getGridTicks(grid: QuantizeGrid, timebase?: MIDITimebase): number

  // Quantize modes
  quantizeRound(tick: number, grid: QuantizeGrid, timebase?: MIDITimebase): number
  quantizeFloor(tick: number, grid: QuantizeGrid, timebase?: MIDITimebase): number
  quantizeCeil(tick: number, grid: QuantizeGrid, timebase?: MIDITimebase): number

  // Strength-based quantization (0-100%)
  quantizeWithStrength(
    tick: number,
    grid: QuantizeGrid,
    strength: number,
    timebase?: MIDITimebase
  ): number

  // Swing (affects off-beats)
  applySwing(
    tick: number,
    swingAmount: number,  // 0-100, 50 = straight
    swingGrid: '1/8' | '1/16',
    timebase?: MIDITimebase
  ): number

  // Batch operations
  quantizeNotes(notes: MIDINoteData[], grid: QuantizeGrid, strength?: number, timebase?: MIDITimebase): MIDINoteData[]
  quantizeNoteLengths(notes: MIDINoteData[], grid: QuantizeGrid, strength?: number, timebase?: MIDITimebase): MIDINoteData[]
}
```

### 2.2 MIDI Time Utilities

**File**: `packages/daw-sdk/src/utils/midi-time.ts`

**Lines**: ~130Time conversion utilities specific to MIDI tick-based timing.> **Note**: The existing `utils/time.ts` handles ms ↔ beats ↔ bars with 960 PPQ.

> This new file focuses on tick-based MIDI operations and note name conversions.

#### Functions

```typescript
export const midiTime = {
  // Tick ↔ Milliseconds
  tickToMs(tick: number, bpm: number, timebase?: MIDITimebase): number
  msToTick(ms: number, bpm: number, timebase?: MIDITimebase): number

  // Tick ↔ Beats
  tickToBeats(tick: number, timebase?: MIDITimebase): number
  beatsToTick(beats: number, timebase?: MIDITimebase): number

  // Bar:Beat:Tick formatting
  formatBBT(tick: number, timeSignature?: [number, number], timebase?: MIDITimebase): string
  parseBBT(bbt: string, timeSignature?: [number, number], timebase?: MIDITimebase): number

  // Note name utilities
  noteNumberToName(note: number): string       // 60 → "C4"
  noteNameToNumber(name: string): number       // "C#4" → 61
  
  // Frequency conversion
  noteNumberToFrequency(note: number): number  // 69 → 440
  frequencyToNoteNumber(freq: number): number  // 440 → 69
  
  // Octave utilities
  getOctave(note: number): number              // 60 → 4
  getNoteInOctave(note: number): number        // 61 → 1 (C#)
}
```

### 2.3 Export Updates

**File**: `packages/daw-sdk/src/utils/index.ts`Add:

```typescript
export { quantization } from "./quantization"
export { midiTime } from "./midi-time"
```

---

## Phase 3: MIDI Player (Scheduler)

**Status**: Planned

**Estimated Lines**: ~350

**Dependencies**: Phase 1 & 2

**File**: `packages/daw-sdk/src/core/midi-player.ts`Timer-based MIDI event scheduler inspired by signal-midi's EventScheduler pattern.

### Architecture

- **setInterval polling** (not RAF) for background tab support
- **Lookahead scheduling** (~100ms) for sample-accurate timing
- **Generation tokens** for safe seek/stop reschedule
- **Loop support** with seamless wrap

### Class: `MIDIPlayer`

```typescript
interface MIDIPlayerCallbacks {
  onNoteOn: (note: number, velocity: number, channel: number) => void
  onNoteOff: (note: number, channel: number) => void
  onControlChange?: (controller: number, value: number, channel: number) => void
  onPitchBend?: (value: number, channel: number) => void
  onPositionChange?: (tick: number, ms: number) => void
  onLoopWrap?: () => void
}

class MIDIPlayer extends EventTarget {
  constructor(callbacks: MIDIPlayerCallbacks, config?: MIDIPlayerConfig)

  // Playback
  play(track: MIDITrack, fromTick?: number): void
  pause(): void
  resume(): void
  stop(): void
  seek(tick: number): void
  isPlaying(): boolean

  // Tempo
  setTempo(bpm: number): void
  getTempo(): number

  // Loop
  setLoop(enabled: boolean, startTick?: number, endTick?: number): void
  getLoop(): { enabled: boolean; startTick: number; endTick: number }

  // Position
  getCurrentTick(): number
  getCurrentMs(): number

  // Timebase
  setTimebase(timebase: MIDITimebase): void
  getTimebase(): MIDITimebase
}
```

---

## Phase 4: MIDI File I/O

**Status**: Deferred (not needed for MVP)

**Dependency**: `@tonejs/midi`

**File**: `packages/daw-sdk/src/utils/midi-file.ts`Import/export `.mid` files using @tonejs/midi library.---

## Phase 5: MIDI Learn System

**Status**: Planned

**Estimated Lines**: ~200

**File**: `packages/daw-sdk/src/core/midi-learn.ts`Real-time CC → parameter mapping.

### Class: `MIDILearnManager`

```typescript
class MIDILearnManager extends EventTarget {
  // Parameter registration
  registerParameter(path: string, setter: (value: number) => void, min?: number, max?: number): void
  unregisterParameter(path: string): void

  // Learn mode
  startLearn(targetPath: string): void
  cancelLearn(): void
  isLearning(): boolean

  // Handle CC events
  handleControlChange(event: MIDIControlChangeEvent): void

  // Bindings CRUD
  getBindings(): MIDILearnBinding[]
  updateBinding(id: string, updates: Partial<MIDILearnBinding>): void
  removeBinding(id: string): void

  // Persistence
  exportBindings(): MIDILearnBinding[]
  importBindings(bindings: MIDILearnBinding[]): void
}
```

---

## Phase 6: React Integration

**Status**: Planned

**Estimated Lines**: ~350

**Package**: `packages/daw-react`

### 6.1 MIDI Atoms

**File**: `packages/daw-react/src/atoms/midi.ts`

```typescript
// Service state
export const midiEnabledAtom = atom(false)
export const midiSupportedAtom = atom(false)

// Devices
export const midiInputsAtom = atom<MIDIDeviceInfo[]>([])
export const selectedMidiInputIdAtom = atom<string | null>(null)
export const midiChannelFilterAtom = atom<number | 'all'>('all')

// Timebase
export const midiTimebaseAtom = atom<MIDITimebase>(960)

// MIDI data
export const midiTracksAtom = atom<MIDITrack[]>([])
export const midiRegionsAtom = atom<MIDIRegion[]>([])
export const activeMidiTrackIdAtom = atom<string | null>(null)

// Player state
export const midiPlayingAtom = atom(false)
export const midiRecordingAtom = atom(false)
export const midiPositionTickAtom = atom(0)
export const midiTempoAtom = atom(120)
export const midiTimeSignatureAtom = atom<[number, number]>([4, 4])

// Quantization
export const quantizeGridAtom = atom<QuantizeGrid>('1/16')
export const quantizeStrengthAtom = atom(100)
export const quantizeSwingAtom = atom(50)

// MIDI Learn
export const midiLearnModeAtom = atom(false)
export const midiLearnTargetAtom = atom<string | null>(null)
export const midiLearnBindingsAtom = atom<MIDILearnBinding[]>([])

// Editor
export const midiEditorViewAtom = atom<'piano-roll' | 'drum-grid'>('piano-roll')
export const selectedMidiNoteIdsAtom = atom<string[]>([])
```

### 6.2 MIDI Hooks

**File**: `packages/daw-react/src/hooks/use-midi.ts`

```typescript
// Device management
export function useMIDIDevices(): {
  supported: boolean
  enabled: boolean
  inputs: MIDIDeviceInfo[]
  selectedId: string | null
  enable: () => Promise<void>
  disable: () => void
  selectInput: (id: string | null) => void
}

// Note input (for sampler triggering)
export function useMIDINotes(): {
  onNoteOn: (callback: (note: number, velocity: number) => void) => void
  onNoteOff: (callback: (note: number) => void) => void
}

// Quantization
export function useQuantize(): {
  grid: QuantizeGrid
  strength: number
  swing: number
  setGrid: (grid: QuantizeGrid) => void
  setStrength: (strength: number) => void
  setSwing: (swing: number) => void
  quantizeSelection: () => void
}

// MIDI Learn
export function useMIDILearn(): {
  isLearning: boolean
  target: string | null
  bindings: MIDILearnBinding[]
  startLearn: (targetPath: string) => void
  cancelLearn: () => void
  removeBinding: (id: string) => void
}
```

---

## Phase 7: UI Components

**Status**: Planned

**Estimated Lines**: ~1,200

### Components

1. **VirtualKeyboard** (`apps/web/components/daw/controls/virtual-keyboard.tsx`)

- Piano layout (2 octaves default, expandable)
- Drum pad grid (4x4)
- Touch velocity support
- Safari fallback message

2. **MIDIDeviceSelector** (`apps/web/components/daw/controls/midi-device-selector.tsx`)

- Dropdown of available inputs
- Connection status indicator
- Channel filter selector

3. **QuantizeBar** (`apps/web/components/daw/controls/quantize-bar.tsx`)

- Grid selector dropdown
- Strength slider
- Swing slider
- Apply button

4. **PianoRoll** (`apps/web/components/daw/panels/piano-roll.tsx`)

- Note editing canvas
- Velocity lane
- Selection tools
- Quantize on input toggle

5. **DrumGrid** (`apps/web/components/daw/panels/drum-grid.tsx`)

- 16-step sequencer view
- Velocity per step
- Pattern length selector

6. **NoteInspector** (`apps/web/components/daw/inspectors/note-inspector.tsx`)

- Selected note properties
- Tick position editor
- Duration editor
- Velocity editor

---

## Implementation Status

| Phase | Component | Status | Lines |

|-------|-----------|--------|-------|

| 1.1 | types/midi.ts | **DONE** | 310 |

| 1.2 | core/midi-service.ts | **DONE** | 387 |

| 1.3 | Export updates | **DONE** | ~20 |

| 2.1 | utils/quantization.ts | **DONE** | 251 |

| 2.2 | utils/midi-time.ts | **DONE** | 298 |

| 2.3 | Export updates | **DONE** | ~10 |

| 3 | core/midi-player.ts | Planned | ~350 |

| 4 | utils/midi-file.ts | Deferred | ~150 |

| 5 | core/midi-learn.ts | Planned | ~200 |

| 6.1 | atoms/midi.ts | Planned | ~100 |

| 6.2 | hooks/use-midi.ts | Planned | ~250 |

| 7 | UI Components | Planned | ~1,200 |---

## File Summary

### Phase 1 & 2 Files (Current Sprint)

```javascript
packages/daw-sdk/src/
├── types/
│   ├── midi.ts              # NEW - MIDI type definitions
│   └── index.ts             # UPDATE - add midi export
├── core/
│   └── midi-service.ts      # NEW - Web MIDI API wrapper
└── utils/
    ├── quantization.ts      # NEW - Grid quantization
    ├── midi-time.ts         # NEW - Tick/time conversions
    └── index.ts             # UPDATE - add exports
```

### Future Files

```javascript
packages/daw-sdk/src/
├── core/
│   ├── midi-player.ts       # Phase 3
│   └── midi-learn.ts        # Phase 5
└── utils/
    └── midi-file.ts         # Phase 4 (deferred)

packages/daw-react/src/
├── atoms/
│   └── midi.ts              # Phase 6
└── hooks/
    └── use-midi.ts          # Phase 6

apps/web/components/daw/
├── controls/
│   ├── virtual-keyboard.tsx # Phase 7
│   ├── midi-device-selector.tsx
│   └── quantize-bar.tsx
├── panels/
│   ├── piano-roll.tsx       # Phase 7
│   └── drum-grid.tsx
└── inspectors/
    └── note-inspector.tsx   # Phase 7
```

---

## Related Documentation

- [Web MIDI API Spec](https://www.w3.org/TR/webmidi/)
- [signal-midi patterns](https://github.com/nicholasrobinson/signal-midi) - EventScheduler architecture
- [@tonejs/midi](https://github.com/Tonejs/Midi) - MIDI file parsing (Phase 4)
- Existing `utils/time.ts` - ms/beats/bars conversions