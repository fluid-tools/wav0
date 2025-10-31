# Bridge Pattern Usage Guide

## Overview

The bridge layer allows the old singleton-based code to coexist with the new SDK architecture during migration. This guide shows how to use the bridges effectively.

## Setting Up Bridges in App

```typescript
// apps/web/app/layout.tsx or wherever DAWProvider is used
import { DAWProvider, browserAdapter } from "@wav0/daw-react";
import { audioService, playbackService } from "@/lib/daw-sdk";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DAWProvider
      storageAdapter={browserAdapter}
      legacyAudioService={audioService}      // Inject old service
      legacyPlaybackService={playbackService} // Inject old service
    >
      {children}
    </DAWProvider>
  );
}
```

## Using Bridges in Components

### Option 1: Direct Bridge Access

```typescript
"use client";

import { useBridges } from "@wav0/daw-react";

export function MyComponent() {
  const { audio, playback } = useBridges();

  const handleLoadAudio = async (file: File) => {
    if (!audio) return;
    
    const audioData = await audio.loadAudioFile(file, "track-1");
    console.log("Audio loaded:", audioData);
  };

  const handlePlay = async () => {
    if (!playback) return;
    
    await playback.play(tracks, 0);
  };

  return (/* ... */);
}
```

### Option 2: Update Atoms to Use Bridges

```typescript
// packages/daw-react/src/atoms/tracks.ts
import { atom } from "jotai";
import { useBridges } from "../providers/daw-provider";

export const updateTrackAtom = atom(
  null,
  async (get, set, trackId: string, updates: Partial<Track>) => {
    const tracks = get(tracksAtom);
    const updatedTracks = tracks.map((track) =>
      track.id !== trackId ? track : { ...track, ...updates }
    );
    
    set(tracksAtom, updatedTracks);

    // Use bridge instead of direct service access
    const { playback } = useBridges(); // This won't work in atom - see next section
    
    if (typeof updates.volume === "number") {
      playback?.updateTrackVolume(trackId, updates.volume);
    }
  },
);
```

**Note**: Atoms can't directly call hooks. See next section for solution.

### Option 3: Create Bridge-Aware Hooks

```typescript
// packages/daw-react/src/hooks/use-track-mutations.ts
import { useAtom } from "jotai";
import { useBridges } from "../providers/daw-provider";
import { tracksAtom } from "../atoms";

export function useTrackMutations() {
  const [tracks, setTracks] = useAtom(tracksAtom);
  const { playback } = useBridges();

  const updateTrack = async (trackId: string, updates: Partial<Track>) => {
    const updatedTracks = tracks.map((track) =>
      track.id !== trackId ? track : { ...track, ...updates }
    );
    
    setTracks(updatedTracks);

    // Bridge calls
    if (playback) {
      if (typeof updates.volume === "number") {
        playback.updateTrackVolume(trackId, updates.volume);
      }
      if (typeof updates.muted === "boolean") {
        const track = updatedTracks.find((t) => t.id === trackId);
        playback.updateTrackMute(trackId, updates.muted, track?.volume ?? 75);
      }
    }
  };

  return { updateTrack };
}

// Usage in component
function MyComponent() {
  const { updateTrack } = useTrackMutations();
  
  return (
    <button onClick={() => updateTrack("track-1", { volume: 80 })}>
      Update Volume
    </button>
  );
}
```

## Event-Driven Patterns

### Syncing Playback State

```typescript
"use client";

import { usePlaybackSync } from "@wav0/daw-react";
import { playbackAtom } from "@wav0/daw-react";

export function PlaybackControls() {
  const { transport, playbackState } = usePlaybackSync({
    playbackAtom,
    enabled: true,
  });

  // playbackState automatically syncs with Transport events
  
  return (
    <div>
      <p>Playing: {playbackState.isPlaying ? "Yes" : "No"}</p>
      <p>Time: {playbackState.currentTime}ms</p>
    </div>
  );
}
```

### Custom Transport Event Handlers

```typescript
"use client";

import { useTransportEvents } from "@wav0/daw-react";

export function TransportMonitor() {
  useTransportEvents({
    onPlay: () => console.log("Playback started"),
    onStop: () => console.log("Playback stopped"),
    onPause: () => console.log("Playback paused"),
    onStateChange: (state, time) => {
      console.log(`State: ${state}, Time: ${time}ms`);
    },
  });

  return <div>Monitoring transport...</div>;
}
```

## Migration Path

### Current (Using Bridges)

```typescript
import { playbackService } from "@/lib/daw-sdk";

// Direct singleton access
await playbackService.play(tracks, 0);
```

### Intermediate (Using Bridges via Context)

```typescript
import { useBridges } from "@wav0/daw-react";

function MyComponent() {
  const { playback } = useBridges();
  
  // Bridge access
  await playback?.play(tracks, 0);
}
```

### Final (Pure SDK)

```typescript
import { useDAWContext } from "@wav0/daw-react";

function MyComponent() {
  const daw = useDAWContext();
  const transport = daw.getTransport();
  
  // Pure SDK access
  await transport.play(clips, 0);
}
```

## Bridge Lifecycle

1. **App Start**: DAWProvider creates bridges, injecting legacy services
2. **Runtime**: Bridges forward calls and sync events
3. **Migration**: Components gradually move from bridges → pure SDK
4. **Cleanup**: Once all code uses pure SDK, remove bridges and legacy services

## Best Practices

1. **Use bridges only during migration** - They're a temporary compatibility layer
2. **Prefer event-driven patterns** - Use hooks like `useTransportEvents`
3. **Test incrementally** - Migrate one component at a time
4. **Keep bridges thin** - Don't add business logic to bridges
5. **Document assumptions** - Mark code that depends on bridges

## Common Patterns

### Loading Audio

```typescript
const { audio } = useBridges();

const handleFileUpload = async (file: File) => {
  if (!audio) return;
  
  try {
    const audioData = await audio.loadAudioFile(file, `audio-${Date.now()}`);
    console.log(`Loaded: ${audioData.duration}ms`);
  } catch (error) {
    console.error("Failed to load audio:", error);
  }
};
```

### Playback Control

```typescript
const { playback } = useBridges();
const [tracks] = useAtom(tracksAtom);

const handlePlay = async () => {
  if (!playback) return;
  await playback.play(tracks, 0);
};

const handleStop = async () => {
  if (!playback) return;
  await playback.stop();
};
```

### Volume Control

```typescript
const { playback } = useBridges();

const handleVolumeChange = (trackId: string, volume: number) => {
  playback?.updateTrackVolume(trackId, volume);
};
```

## Next Steps

Once all components use the new patterns:
1. Remove bridge layer
2. Remove legacy services
3. Update all imports to use pure SDK
4. Clean up temporary compatibility code

