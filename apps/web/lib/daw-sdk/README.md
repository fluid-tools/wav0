# WAV0 DAW SDK

Modular, type-safe, SDK-level DAW library for web-based audio production.

## Architecture

```
daw-sdk/
├── core/               # Core services (singletons)
│   ├── audio-service.ts       # MediaBunny audio file management
│   └── playback-service.ts    # Multi-clip playback engine
├── types/              # Zod schemas and TypeScript types
│   └── schemas.ts
├── utils/              # Pure utility functions
│   ├── curve-functions.ts     # Automation curve math
│   ├── time-utils.ts          # Time conversion/formatting
│   ├── volume-utils.ts        # Volume/dB conversions
│   └── automation-utils.ts    # Automation helpers
├── hooks/              # React hooks
│   ├── use-playback-sync.ts   # Playback synchronization
│   └── use-drag-interaction.ts # Drag & drop interactions
└── index.ts            # Public API
```

## Key Features

- **Full Zod Validation**: All types validated at runtime
- **MediaBunny Integration**: Proper iterator-based playback
- **Modular Design**: Clean separation of concerns
- **Type-Safe**: End-to-end TypeScript support
- **React Hooks**: Consolidated useEffect patterns
- **Web Standards**: Built on Web Audio API, OPFS

## Usage

### Initialization

```typescript
import { initializeDAW, cleanupDAW } from '@/lib/daw-sdk'

// In your app setup
await initializeDAW()

// On unmount
await cleanupDAW()
```

### Audio Service

```typescript
import { audioService } from '@/lib/daw-sdk'

// Load audio file
const info = await audioService.loadAudioFile(file, trackId)

// Get audio buffer sink for playback
const sink = audioService.getAudioBufferSink(trackId)

// Load from OPFS
const info = await audioService.loadTrackFromOPFS(trackId, fileName)
```

### Playback Service

```typescript
import { playbackService } from '@/lib/daw-sdk'

// Initialize with tracks
await playbackService.initializeWithTracks(tracks)

// Start playback
await playbackService.play(tracks, {
  startTime: 0,
  onTimeUpdate: (time) => console.log(time),
  onPlaybackEnd: () => console.log('done'),
})

// Control playback
await playbackService.pause()
await playbackService.stop()
```

### Type Validation

```typescript
import { TrackSchema, ClipSchema } from '@/lib/daw-sdk'

// Validate at runtime
const track = TrackSchema.parse(data)
const clip = ClipSchema.parse(clipData)
```

### Utilities

```typescript
import {
  formatDuration,
  snapToGrid,
  volumeToDb,
  evaluateCurve,
  getEnvelopeMultiplierAtTime,
} from '@/lib/daw-sdk'

// Format time
const formatted = formatDuration(5000) // "0:05.000"

// Snap to grid
const snapped = snapToGrid(5123, 120, 16) // Snap to 16th note at 120 BPM

// Volume conversion
const db = volumeToDb(75) // Convert 75% to dB

// Automation
const multiplier = getEnvelopeMultiplierAtTime(points, 5000)
```

### React Hooks

```typescript
import {
  usePlaybackSync,
  useScrollSync,
  useDragInteraction,
  useKeyboardShortcut,
} from '@/lib/daw-sdk'

// Playback sync
usePlaybackSync(isPlaying, currentTime, (time) => {
  console.log('Current time:', time)
})

// Scroll sync between elements
useScrollSync([ref1, ref2, ref3], (left, top) => {
  console.log('Scrolled to:', left, top)
})

// Drag interaction
const { isDragging, startDrag } = useDragInteraction({
  onDragStart: (e, state) => console.log('Started', state),
  onDragMove: (e, state) => console.log('Moving', state),
  onDragEnd: (e, state) => console.log('Ended', state),
  lockScroll: true,
})

// Keyboard shortcuts
useKeyboardShortcut(['meta+s', 'ctrl+s'], (e) => {
  e.preventDefault()
  console.log('Save triggered')
})
```

## Migration Guide

### From Old Architecture

**Before:**
```typescript
import { audioManager } from '@/lib/audio/audio-manager'
import { playbackEngine } from '@/lib/audio/playback-engine'
```

**After:**
```typescript
import { audioService, playbackService } from '@/lib/daw-sdk'
```

### Type Changes

**Before:**
```typescript
import type { Track, Clip } from '@/lib/state/daw-store'
```

**After:**
```typescript
import type { Track, Clip } from '@/lib/daw-sdk'
// Or import schemas for validation
import { TrackSchema, ClipSchema } from '@/lib/daw-sdk'
```

### Utility Changes

**Before:**
```typescript
import { formatDuration } from '@/lib/storage/opfs'
import { volumeToDb } from '@/lib/audio/volume'
import { evaluateCurve } from '@/lib/audio/curve-functions'
```

**After:**
```typescript
import {
  formatDuration,
  volumeToDb,
  evaluateCurve,
} from '@/lib/daw-sdk'
```

### Hook Consolidation

**Before:**
```typescript
useEffect(() => {
  // Manual event listener setup
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [])
```

**After:**
```typescript
useKeyboardShortcut(['space'], handler)
```

## Design Principles

1. **SDK-Level Quality**: Production-ready, thoroughly validated
2. **Modular**: Clean separation, easy to test
3. **Type-Safe**: Runtime validation with Zod
4. **Performance**: Optimized for real-time audio
5. **Standards-Based**: Web Audio API, OPFS, MediaBunny
6. **DRY**: No code duplication
7. **KISS**: Simple, straightforward APIs

## API Reference

### Core Services

#### AudioService
- `loadAudioFile(file, trackId)` - Load audio from File object
- `loadTrackFromOPFS(trackId, fileName)` - Load from storage
- `getAudioBufferSink(trackId)` - Get MediaBunny sink
- `getTrackInfo(trackId)` - Get audio metadata
- `isTrackLoaded(trackId)` - Check if loaded
- `unloadTrack(trackId)` - Free memory
- `cleanup()` - Cleanup all resources

#### PlaybackService
- `initializeWithTracks(tracks)` - Initialize playback
- `play(tracks, options)` - Start playback
- `pause()` - Pause playback
- `stop()` - Stop and reset
- `rescheduleTrack(track)` - Update during playback
- `getCurrentTime()` - Get current time
- `getIsPlaying()` - Check playing state
- `updateTrackVolume(trackId, volume)` - Update volume
- `updateTrackMute(trackId, muted)` - Update mute
- `updateSoloStates(tracks)` - Update solo
- `updateMasterVolume(volume)` - Update master
- `cleanup()` - Cleanup resources

### Utilities

#### Time
- `formatDuration(ms, options)` - Format time display
- `secondsToMs(seconds)` - Convert to milliseconds
- `msToSeconds(ms)` - Convert to seconds
- `snapToGrid(timeMs, bpm, division)` - Snap to grid
- `calculateBeatMarkers(bpm, width, pxPerMs)` - Beat markers
- `calculateTimeMarkers(width, pxPerMs, zoom)` - Time markers

#### Volume
- `volumeToDb(volume)` - Convert % to dB
- `dbToVolume(db)` - Convert dB to %
- `formatDb(db, precision)` - Format dB display
- `multiplierToDb(multiplier)` - Envelope multiplier to dB
- `dbToMultiplier(db)` - dB to envelope multiplier
- `getEffectiveDb(baseVolume, multiplier)` - Combined dB

#### Curves
- `evaluateCurve(type, t, shape)` - Calculate curve value
- `generateCurve(type, start, end, duration, shape)` - Generate samples
- `applyCurveToParam(param, type, ...)` - Apply to AudioParam
- `getCurveLabel(type)` - Get curve name
- `getCurveDescription(type)` - Get curve description

#### Automation
- `countAutomationPointsInRange(track, start, end)` - Count points
- `getAutomationPointsInRange(track, start, end)` - Get points
- `transferAutomationPoints(...)` - Transfer between tracks
- `removeAutomationPointsInRange(track, start, end)` - Remove points
- `getEnvelopeMultiplierAtTime(points, time)` - Get value at time

### React Hooks

- `usePlaybackSync(isPlaying, currentTime, callback)` - Sync playback
- `useScrollSync(refs, onScroll)` - Sync scroll
- `useResizeObserver(ref, callback)` - Observe resize
- `useDocumentEvent(event, handler)` - Document events
- `useWindowEvent(event, handler)` - Window events
- `useCustomEvent(event, handler)` - Custom events
- `useDragInteraction(options)` - Drag handling
- `useKeyboardShortcut(keys, handler)` - Keyboard shortcuts

## Testing

```bash
bun test lib/daw-sdk
```

## License

See main project LICENSE
