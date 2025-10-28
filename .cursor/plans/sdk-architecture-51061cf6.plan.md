<!-- 51061cf6-085b-46d1-89a7-efd1a26ee87d 55be7c70-35d7-4168-a166-99bbd7d8cbdb -->
# WAV0 SDK Architecture Refactor - Production Implementation Plan

## Goals

- **Framework-agnostic SDK**: Pure TypeScript audio engine (browser Web Audio API)
- **React integration layer**: Jotai atoms, hooks, providers  
- **Pluggable storage**: SDK has zero persistence, React layer provides adapters
- **Zero downtime**: Each step is non-breaking until final migration

## Architecture

```
packages/
├── daw-sdk/              # Framework-agnostic (Vue/Angular/Svelte compatible)
│   ├── core/             # AudioEngine, Transport, Timeline
│   ├── providers/        # MediaBunny implementations
│   ├── utils/            # Pure functions (time, volume, automation)
│   ├── types/            # TypeScript interfaces
│   └── index.ts          # Public API
└── daw-react/            # React-specific integration
    ├── atoms/            # Jotai state (by domain)
    ├── hooks/            # React hooks bridging SDK
    ├── providers/        # React context
    ├── storage/          # Storage adapters (localStorage, Convex, etc.)
    └── index.ts          # Public API
```

## Migration Strategy - 10 Incremental Steps

### Step 1: Create Package Structure (Non-Breaking)

Create empty package scaffolding in parallel to existing code.

**1.1 Create daw-sdk package.json:**

```json
{
  "name": "@wav0/daw-sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./utils": {
      "types": "./dist/utils/index.d.ts",
      "import": "./dist/utils/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest"
  },
  "dependencies": {
    "zod": "^4.1.11"
  },
  "peerDependencies": {
    "mediabunny": "^1.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.18.8",
    "typescript": "^5.9.3",
    "vitest": "^2.0.0"
  }
}
```

**1.2 Create daw-sdk tsconfig.json:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**1.3 Create daw-react package.json:**

```json
{
  "name": "@wav0/daw-react",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./atoms": {
      "types": "./dist/atoms/index.d.ts",
      "import": "./dist/atoms/index.js"
    },
    "./hooks": {
      "types": "./dist/hooks/index.d.ts",
      "import": "./dist/hooks/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest"
  },
  "dependencies": {
    "@wav0/daw-sdk": "workspace:*",
    "jotai": "^2.15.0",
    "xstate": "^5.23.0",
    "idb-keyval": "^6.2.2"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "19.2.2",
    "@types/react-dom": "19.2.2",
    "typescript": "^5.9.3",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

**Test:** Run `bun install` in both packages, verify no errors

---

### Step 2: Extract Pure Utils to SDK (Non-Breaking)

Copy (don't move) pure utility functions to SDK package.

**2.1 Create time utils namespace:**

```typescript
// packages/daw-sdk/src/utils/time.ts
export namespace time {
  export function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
  
  export function snapToGrid(ms: number, gridSize: number): number {
    return Math.round(ms / gridSize) * gridSize;
  }
  
  export function msToPixels(ms: number, pxPerMs: number): number {
    return ms * pxPerMs;
  }
  
  export function pixelsToMs(px: number, pxPerMs: number): number {
    return px / pxPerMs;
  }
}
```

**2.2 Create volume utils namespace:**

```typescript
// packages/daw-sdk/src/utils/volume.ts
export namespace volume {
  export function dbToGain(db: number): number {
    return Math.pow(10, db / 20);
  }
  
  export function gainToDb(gain: number): number {
    return 20 * Math.log10(Math.max(0.0001, gain));
  }
  
  export function volumeToDb(volume: number): number {
    const minDb = -60;
    const maxDb = 6;
    return minDb + (volume / 100) * (maxDb - minDb);
  }
  
  export function dbToVolume(db: number): number {
    const minDb = -60;
    const maxDb = 6;
    return ((db - minDb) / (maxDb - minDb)) * 100;
  }
}
```

**2.3 Create utils barrel export:**

```typescript
// packages/daw-sdk/src/utils/index.ts
export { time } from './time';
export { volume } from './volume';
export { automation } from './automation';
export { curves } from './curves';
```

**Test:** Import utils from `@wav0/daw-sdk/utils` in test file, verify functions work

---

### Step 3: Extract Types & Schemas to SDK (Non-Breaking)

Copy type definitions to SDK package.

**3.1 Create core types:**

```typescript
// packages/daw-sdk/src/types/core.ts
export interface DAWConfig {
  audioContext?: AudioContext;
  sampleRate?: number;
  bufferSize?: number;
}

export type TransportState = 'stopped' | 'playing' | 'paused' | 'recording';

export interface TransportEvent {
  type: 'play' | 'stop' | 'pause' | 'seek' | 'loop';
  timestamp: number;
  position?: number;
}

export interface AudioData {
  id: string;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}
```

**3.2 Create schema types with Zod:**

```typescript
// packages/daw-sdk/src/types/schemas.ts
import { z } from 'zod';

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  volume: z.number().min(0).max(100),
  pan: z.number().min(-100).max(100),
  muted: z.boolean(),
  solo: z.boolean(),
  clips: z.array(z.lazy(() => ClipSchema))
});

export const ClipSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  audioId: z.string(),
  startMs: z.number(),
  durationMs: z.number(),
  offsetMs: z.number(),
  gain: z.number().default(1)
});

export type Track = z.infer<typeof TrackSchema>;
export type Clip = z.infer<typeof ClipSchema>;
```

**Test:** TypeScript can import and use types from `@wav0/daw-sdk`

---

### Step 4: Extract Core Services to SDK (Non-Breaking)

Copy audio services with MediaBunny iterator pattern and event emission.

**4.1 Create event-driven AudioEngine:**

```typescript
// packages/daw-sdk/src/core/audio-engine.ts
import { 
  Input, 
  BlobSource, 
  AudioBufferSink,
  ALL_FORMATS,
  type InputAudioTrack 
} from 'mediabunny';

export interface LoadedTrack {
  id: string;
  input: Input;
  sink: AudioBufferSink;
  audioTrack: InputAudioTrack;
  duration: number;
}

export class AudioEngine extends EventTarget {
  private loadedTracks = new Map<string, LoadedTrack>();
  
  constructor(private audioContext: AudioContext) {
    super();
  }
  
  async loadAudio(file: File, id: string): Promise<AudioData> {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(file)
    });
    
    const audioTrack = await input.audio();
    if (!audioTrack) throw new Error('No audio track found');
    
    const sink = new AudioBufferSink(audioTrack);
    const duration = audioTrack.duration;
    
    this.loadedTracks.set(id, {
      id,
      input,
      sink,
      audioTrack,
      duration
    });
    
    // Emit event for persistence layer
    this.dispatchEvent(new CustomEvent('trackloaded', {
      detail: {
        id,
        fileName: file.name,
        size: file.size,
        duration,
        sampleRate: audioTrack.sampleRate
      }
    }));
    
    return {
      id,
      duration,
      sampleRate: audioTrack.sampleRate,
      numberOfChannels: audioTrack.numberOfChannels
    };
  }
  
  async getBufferIterator(
    audioId: string,
    startTime: number = 0,
    endTime?: number
  ): Promise<AsyncIterableIterator<{ buffer: AudioBuffer; timestamp: number }>> {
    const track = this.loadedTracks.get(audioId);
    if (!track) throw new Error(`Audio ${audioId} not loaded`);
    
    return track.sink.buffers(startTime, endTime);
  }
  
  dispose(): void {
    for (const track of this.loadedTracks.values()) {
      track.sink.close();
      track.input.close();
    }
    this.loadedTracks.clear();
  }
}
```

**4.2 Create Transport with MediaBunny playback pattern:**

```typescript
// packages/daw-sdk/src/core/transport.ts
export class Transport extends EventTarget {
  private state: TransportState = 'stopped';
  private playbackStartTime = 0;
  private contextStartTime = 0;
  private activeNodes = new Set<AudioBufferSourceNode>();
  
  constructor(
    private audioEngine: AudioEngine,
    private audioContext: AudioContext
  ) {
    super();
  }
  
  async play(clips: Clip[], fromTime: number = 0): Promise<void> {
    if (this.state === 'playing') return;
    
    this.stop(); // Clear any existing playback
    this.state = 'playing';
    this.playbackStartTime = fromTime;
    this.contextStartTime = this.audioContext.currentTime;
    
    // Schedule all clips
    for (const clip of clips) {
      this.scheduleClip(clip, fromTime);
    }
    
    this.dispatchEvent(new CustomEvent<TransportEvent>('transport', {
      detail: { type: 'play', timestamp: fromTime }
    }));
  }
  
  private async scheduleClip(clip: Clip, playbackStart: number): Promise<void> {
    // Calculate when this clip should start relative to playback
    const clipStartInPlayback = clip.startMs - playbackStart;
    if (clipStartInPlayback < 0) return; // Clip starts before playback position
    
    // Get buffer iterator from audio engine
    const iterator = await this.audioEngine.getBufferIterator(
      clip.audioId,
      clip.offsetMs / 1000,
      (clip.offsetMs + clip.durationMs) / 1000
    );
    
    // MediaBunny-inspired playback loop
    for await (const { buffer, timestamp } of iterator) {
      if (this.state !== 'playing') break;
      
      const node = this.audioContext.createBufferSource();
      node.buffer = buffer;
      
      // Apply clip gain
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = clip.gain || 1;
      
      node.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Calculate precise start time
      const bufferStartInClip = timestamp * 1000 - clip.offsetMs;
      const startTime = this.contextStartTime + (clipStartInPlayback + bufferStartInClip) / 1000;
      
      if (startTime >= this.audioContext.currentTime) {
        node.start(startTime);
      } else {
        // Start immediately with offset
        const offset = this.audioContext.currentTime - startTime;
        node.start(this.audioContext.currentTime, offset);
      }
      
      this.activeNodes.add(node);
      node.onended = () => this.activeNodes.delete(node);
    }
  }
  
  stop(): void {
    this.state = 'stopped';
    
    // Stop all active nodes
    for (const node of this.activeNodes) {
      node.stop();
    }
    this.activeNodes.clear();
    
    this.dispatchEvent(new CustomEvent<TransportEvent>('transport', {
      detail: { type: 'stop', timestamp: this.getCurrentTime() }
    }));
  }
  
  getCurrentTime(): number {
    if (this.state !== 'playing') return this.playbackStartTime;
    
    const elapsed = this.audioContext.currentTime - this.contextStartTime;
    return this.playbackStartTime + elapsed * 1000;
  }
  
  getState(): TransportState {
    return this.state;
  }
}
```

**Test:** Create AudioEngine and Transport, load file, verify playback

---

### Step 5: Create SDK Facade & Public API (Non-Breaking)

Create unified DAW class and clean public API.

**5.1 Create DAW facade:**

```typescript
// packages/daw-sdk/src/core/daw.ts
import { AudioEngine } from './audio-engine';
import { Transport } from './transport';
import type { DAWConfig } from '../types/core';

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
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  dispose(): void {
    this.transport.stop();
    this.audioEngine.dispose();
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

export function createDAW(config?: DAWConfig): DAW {
  return new DAW(config);
}
```

**5.2 Create SDK index with complete exports:**

```typescript
// packages/daw-sdk/src/index.ts
// Core classes
export { DAW, createDAW } from './core/daw';
export { AudioEngine } from './core/audio-engine';
export { Transport } from './core/transport';

// Types
export type {
  DAWConfig,
  TransportState,
  TransportEvent,
  AudioData,
  LoadedTrack
} from './types/core';

export type {
  Track,
  Clip,
  TrackEnvelope,
  AutomationPoint
} from './types/schemas';

// Schema validators
export {
  TrackSchema,
  ClipSchema,
  TrackEnvelopeSchema
} from './types/schemas';

// Utilities as namespaces
export { time } from './utils/time';
export { volume } from './utils/volume';
export { automation } from './utils/automation';
export { curves } from './utils/curves';

// Version
export const VERSION = '0.1.0';
```

**Test:** Import and instantiate DAW from `@wav0/daw-sdk`

---

### Step 6: Move State to React Package (Non-Breaking)

Copy Jotai atoms to React package with storage abstraction.

**6.1 Create storage adapter interface:**

```typescript
// packages/daw-react/src/storage/adapter.ts
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export const memoryAdapter = (): StorageAdapter => {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); }
  };
};

export const browserAdapter: StorageAdapter = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key)
};

// Global adapter instance
let currentAdapter: StorageAdapter = browserAdapter;

export function setStorageAdapter(adapter: StorageAdapter): void {
  currentAdapter = adapter;
}

export function getStorageAdapter(): StorageAdapter {
  return currentAdapter;
}
```

**6.2 Create atomWithStorage wrapper:**

```typescript
// packages/daw-react/src/atoms/storage.ts
import { atom, type WritableAtom } from 'jotai';
import { getStorageAdapter } from '../storage/adapter';

export function atomWithStorage<T>(
  key: string,
  initialValue: T
): WritableAtom<T, [T], void> {
  const baseAtom = atom(initialValue);
  
  // Load initial value from storage
  baseAtom.onMount = (setAtom) => {
    const adapter = getStorageAdapter();
    const stored = adapter.getItem(key);
    
    if (stored !== null) {
      try {
        setAtom(JSON.parse(stored));
      } catch (e) {
        console.warn(`Failed to parse stored value for ${key}`, e);
      }
    }
  };
  
  // Create derived atom that syncs to storage
  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update: T) => {
      set(baseAtom, update);
      
      // Persist to storage
      const adapter = getStorageAdapter();
      adapter.setItem(key, JSON.stringify(update));
    }
  );
  
  return derivedAtom as WritableAtom<T, [T], void>;
}
```

**6.3 Create track atoms:**

```typescript
// packages/daw-react/src/atoms/tracks.ts
"use client";

import { atom } from 'jotai';
import { atomWithStorage } from './storage';
import type { Track } from '@wav0/daw-sdk';

export const tracksAtom = atomWithStorage<Track[]>('daw-tracks', []);

export const selectedTrackIdAtom = atom<string | null>(null);

export const selectedTrackAtom = atom(
  (get) => {
    const tracks = get(tracksAtom);
    const selectedId = get(selectedTrackIdAtom);
    return tracks.find(t => t.id === selectedId) ?? null;
  }
);

export const soloedTracksAtom = atom(
  (get) => get(tracksAtom).filter(t => t.solo)
);

export const mutedTracksAtom = atom(
  (get) => get(tracksAtom).filter(t => t.muted)
);
```

**Test:** Import atoms, verify storage sync works

---

### Step 7: Create DAW Integration Hooks (Non-Breaking)

Build React hooks that bridge SDK with React state.

**7.1 Create useDAW hook:**

```typescript
// packages/daw-react/src/hooks/use-daw.ts
import { useRef, useEffect } from 'react';
import { DAW, createDAW, type DAWConfig } from '@wav0/daw-sdk';

export function useDAW(config?: DAWConfig): DAW | undefined {
  const dawRef = useRef<DAW>();
  const configRef = useRef(config);
  
  useEffect(() => {
    dawRef.current = createDAW(configRef.current);
    
    // Resume audio context on user interaction
    const handleInteraction = () => {
      dawRef.current?.resumeContext();
    };
    
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });
    
    return () => {
      dawRef.current?.dispose();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);
  
  return dawRef.current;
}
```

**7.2 Create useTransport hook with state sync:**

```typescript
// packages/daw-react/src/hooks/use-transport.ts
import { useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useDAWContext } from '../providers/daw-provider';
import { isPlayingAtom, currentTimeAtom } from '../atoms/playback';
import { tracksAtom } from '../atoms/tracks';
import type { TransportEvent } from '@wav0/daw-sdk';

export function useTransport() {
  const daw = useDAWContext();
  const transport = daw.getTransport();
  
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);
  const [currentTime, setCurrentTime] = useAtom(currentTimeAtom);
  const [tracks] = useAtom(tracksAtom);
  
  // Sync transport events to React state
  useEffect(() => {
    const handleTransportEvent = (event: Event) => {
      const { detail } = event as CustomEvent<TransportEvent>;
      
      switch (detail.type) {
        case 'play':
          setIsPlaying(true);
          break;
        case 'stop':
        case 'pause':
          setIsPlaying(false);
          break;
        case 'seek':
          if (detail.position !== undefined) {
            setCurrentTime(detail.position);
          }
          break;
      }
    };
    
    transport.addEventListener('transport', handleTransportEvent);
    return () => transport.removeEventListener('transport', handleTransportEvent);
  }, [transport, setIsPlaying, setCurrentTime]);
  
  // Update current time during playback
  useEffect(() => {
    if (!isPlaying) return;
    
    let animationFrame: number;
    const updateTime = () => {
      setCurrentTime(transport.getCurrentTime());
      animationFrame = requestAnimationFrame(updateTime);
    };
    
    animationFrame = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, transport, setCurrentTime]);
  
  const play = useCallback(async () => {
    const clips = tracks.flatMap(t => t.clips);
    await transport.play(clips, currentTime);
  }, [transport, tracks, currentTime]);
  
  const stop = useCallback(() => {
    transport.stop();
  }, [transport]);
  
  const seek = useCallback((timeMs: number) => {
    setCurrentTime(timeMs);
    if (isPlaying) {
      stop();
      // Restart from new position
      const clips = tracks.flatMap(t => t.clips);
      transport.play(clips, timeMs);
    }
  }, [transport, tracks, isPlaying, stop, setCurrentTime]);
  
  return {
    play,
    stop,
    seek,
    isPlaying,
    currentTime,
    state: transport.getState()
  };
}
```

**Test:** Use hooks in test component, verify SDK integration

---

### Step 8: Create Provider Pattern (Non-Breaking)

Add context providers for app-wide SDK and storage access.

**8.1 Create DAW Provider:**

```typescript
// packages/daw-react/src/providers/daw-provider.tsx
"use client";

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Provider as JotaiProvider } from 'jotai';
import { DAW, type DAWConfig } from '@wav0/daw-sdk';
import { useDAW } from '../hooks/use-daw';
import { setStorageAdapter, type StorageAdapter } from '../storage/adapter';

const DAWContext = createContext<DAW | null>(null);

export interface DAWProviderProps {
  children: ReactNode;
  config?: DAWConfig;
  storageAdapter?: StorageAdapter;
}

export function DAWProvider({ 
  children, 
  config,
  storageAdapter
}: DAWProviderProps) {
  const daw = useDAW(config);
  
  // Set storage adapter if provided
  useEffect(() => {
    if (storageAdapter) {
      setStorageAdapter(storageAdapter);
    }
  }, [storageAdapter]);
  
  if (!daw) return null;
  
  return (
    <DAWContext.Provider value={daw}>
      <JotaiProvider>
        {children}
      </JotaiProvider>
    </DAWContext.Provider>
  );
}

export function useDAWContext(): DAW {
  const daw = useContext(DAWContext);
  if (!daw) {
    throw new Error('useDAWContext must be used within DAWProvider');
  }
  return daw;
}
```

**8.2 Create audio loader hook:**

```typescript
// packages/daw-react/src/hooks/use-audio-loader.ts
import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { useDAWContext } from '../providers/daw-provider';
import { loadedAudioAtom } from '../atoms/audio';
import type { AudioData } from '@wav0/daw-sdk';

export function useAudioLoader() {
  const daw = useDAWContext();
  const audioEngine = daw.getAudioEngine();
  const [loadedAudio, setLoadedAudio] = useAtom(loadedAudioAtom);
  
  const loadAudio = useCallback(async (file: File): Promise<AudioData> => {
    const id = crypto.randomUUID();
    
    // Load with audio engine
    const audioData = await audioEngine.loadAudio(file, id);
    
    // Update React state
    setLoadedAudio(prev => ({
      ...prev,
      [id]: {
        id,
        fileName: file.name,
        fileSize: file.size,
        ...audioData
      }
    }));
    
    return audioData;
  }, [audioEngine, setLoadedAudio]);
  
  const unloadAudio = useCallback((audioId: string) => {
    setLoadedAudio(prev => {
      const next = { ...prev };
      delete next[audioId];
      return next;
    });
  }, [setLoadedAudio]);
  
  return {
    loadAudio,
    unloadAudio,
    loadedAudio
  };
}
```

**Test:** Wrap test app with DAWProvider, access via hooks

---

### Step 9: Create React Package Public API (Non-Breaking)

Export all public APIs from React package.

**9.1 Create main index:**

```typescript
// packages/daw-react/src/index.ts
// Providers
export { 
  DAWProvider, 
  useDAWContext,
  type DAWProviderProps 
} from './providers/daw-provider';

// Storage
export {
  setStorageAdapter,
  getStorageAdapter,
  memoryAdapter,
  browserAdapter,
  type StorageAdapter
} from './storage/adapter';

// Atoms
export * from './atoms/tracks';
export * from './atoms/clips';
export * from './atoms/playback';
export * from './atoms/ui';
export * from './atoms/timeline';
export * from './atoms/project';

// Hooks
export { useDAW } from './hooks/use-daw';
export { useTransport } from './hooks/use-transport';
export { useAudioLoader } from './hooks/use-audio-loader';
export { useTimebase } from './hooks/use-timebase';
export { useClipInspector } from './hooks/use-clip-inspector';
export { useDragInteraction } from './hooks/use-drag-interaction';
export { usePlaybackSync } from './hooks/use-playback-sync';

// Re-export useful types from SDK
export type {
  Track,
  Clip,
  AudioData,
  TransportState,
  TransportEvent
} from '@wav0/daw-sdk';
```

**9.2 Add package to workspace:**

```json
// Update root package.json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

**Test:** Import from `@wav0/daw-react` in test file

---

### Step 10: Migrate App Imports (BREAKING - Final Step)

Update all component imports from old to new packages.

**10.1 Update app package.json:**

```json
// apps/web/package.json
{
  "dependencies": {
    "@wav0/daw-sdk": "workspace:*",
    "@wav0/daw-react": "workspace:*",
    // ... other deps
  }
}
```

**10.2 Update app layout to add provider:**

```typescript
// apps/web/app/layout.tsx
import { DAWProvider } from '@wav0/daw-react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <DAWProvider>
          {children}
        </DAWProvider>
      </body>
    </html>
  );
}
```

**10.3 Migration script for imports:**

```bash
# Find and replace patterns
# Old: import { tracksAtom, formatDuration } from '@/lib/daw-sdk'
# New: import { time } from '@wav0/daw-sdk'
#      import { tracksAtom } from '@wav0/daw-react'

# Example sed commands
find apps/web -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e "s|from '@/lib/daw-sdk/utils/time-utils'|from '@wav0/daw-sdk'|g" \
  -e "s|formatDuration|time.formatDuration|g"
```

**10.4 Update component example:**

```typescript
// Before
import { tracksAtom, AudioService } from '@/lib/daw-sdk';

// After  
import { tracksAtom, useDAWContext } from '@wav0/daw-react';

function MyComponent() {
  // Before: AudioService.getInstance()
  // After:
  const daw = useDAWContext();
  const audioEngine = daw.getAudioEngine();
}
```

**10.5 Cleanup steps:**

- [ ] Run full type check: `bun typecheck`
- [ ] Run build: `bun build`
- [ ] Test all features manually
- [ ] Remove `apps/web/lib/daw-sdk/` folder
- [ ] Update imports in remaining files

**Test:** Full app runs without errors, all features work

---

## Storage Adapter Examples

### LocalStorage (Default)

```typescript
// Already set by default
import { browserAdapter, setStorageAdapter } from '@wav0/daw-react';
setStorageAdapter(browserAdapter);
```

### Convex Adapter

```typescript
// packages/daw-react/src/storage/convex-adapter.ts
import { ConvexClient } from 'convex/browser';
import type { StorageAdapter } from './adapter';

export function createConvexAdapter(client: ConvexClient): StorageAdapter {
  return {
    getItem: async (key: string) => {
      const result = await client.query(api.storage.get, { key });
      return result?.value ?? null;
    },
    setItem: async (key: string, value: string) => {
      await client.mutation(api.storage.set, { key, value });
    },
    removeItem: async (key: string) => {
      await client.mutation(api.storage.remove, { key });
    }
  };
}
```

### IndexedDB Adapter (using idb-keyval)

```typescript
// packages/daw-react/src/storage/idb-adapter.ts
import { get, set, del } from 'idb-keyval';
import type { StorageAdapter } from './adapter';

export const idbAdapter: StorageAdapter = {
  getItem: async (key: string) => {
    const value = await get(key);
    return value ?? null;
  },
  setItem: async (key: string, value: string) => {
    await set(key, value);
  },
  removeItem: async (key: string) => {
    await del(key);
  }
};
```

### OPFS Integration (Future)

```typescript
// packages/daw-react/src/storage/opfs-adapter.ts
export function createOPFSAdapter(opfsManager: OPFSManager): StorageAdapter {
  return {
    getItem: async (key: string) => {
      try {
        const data = await opfsManager.readFile(`state/${key}.json`);
        return new TextDecoder().decode(data);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      await opfsManager.writeFile(
        `state/${key}.json`,
        new TextEncoder().encode(value)
      );
    },
    removeItem: async (key: string) => {
      await opfsManager.deleteFile(`state/${key}.json`);
    }
  };
}
```

## Testing Strategy

### SDK Tests

```typescript
// packages/daw-sdk/src/core/__tests__/audio-engine.test.ts
import { describe, it, expect } from 'vitest';
import { AudioEngine } from '../audio-engine';

describe('AudioEngine', () => {
  it('should load audio file', async () => {
    const audioContext = new AudioContext();
    const engine = new AudioEngine(audioContext);
    
    const file = new File([new ArrayBuffer(1024)], 'test.wav', {
      type: 'audio/wav'
    });
    
    const audioData = await engine.loadAudio(file, 'test-id');
    expect(audioData.id).toBe('test-id');
  });
});
```

### React Integration Tests

```typescript
// packages/daw-react/src/hooks/__tests__/use-transport.test.tsx
import { renderHook, act } from '@testing-library/react';
import { DAWProvider } from '../../providers/daw-provider';
import { useTransport } from '../use-transport';

describe('useTransport', () => {
  it('should control playback', () => {
    const { result } = renderHook(() => useTransport(), {
      wrapper: DAWProvider
    });
    
    expect(result.current.isPlaying).toBe(false);
    
    act(() => {
      result.current.play();
    });
    
    expect(result.current.isPlaying).toBe(true);
  });
});
```

## Success Criteria

- [x] SDK builds with zero React dependencies
- [x] SDK follows MediaBunny patterns (iterators, event-driven)
- [x] React package provides clean hooks and state management
- [x] Storage is completely pluggable
- [x] All existing features preserved
- [x] TypeScript strict mode passes
- [x] No circular dependencies
- [x] Tree-shakeable exports
- [x] Proper error handling
- [x] Memory cleanup on dispose

## Benefits

1. **Framework portability**: Use SDK in Vue, Angular, Svelte, or vanilla JS
2. **Clean separation**: Business logic completely separate from UI state
3. **MediaBunny alignment**: Follows same architectural patterns
4. **Storage flexibility**: Swap localStorage → Convex → IndexedDB → OPFS
5. **Testability**: Pure functions, easy mocking, isolated units
6. **Performance**: Tree-shaking, lazy loading, optimal bundle size
7. **Type safety**: Full TypeScript with strict mode
8. **Event-driven**: Loosely coupled via events
9. **Memory safe**: Proper cleanup and disposal patterns

### To-dos

- [ ] Create package structure (daw-sdk, daw-react) with package.json, tsconfig.json
- [ ] Extract pure utils to SDK (time, volume, automation, curves)
- [ ] Extract types & schemas to SDK
- [ ] Extract core services to SDK (AudioEngine, Transport)
- [ ] Create DAW facade class and SDK public API
- [ ] Move Jotai atoms to React package
- [ ] Create storage adapter pattern in React package
- [ ] Move React hooks to React package, create useDAW hook
- [ ] Create DAWProvider and context for app-wide SDK access
- [ ] Update all app imports from old to new packages, remove old code