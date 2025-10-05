# DAW SDK Usage Guide

## Quick Start

The SDK is automatically initialized when the app starts. No manual setup required.

```typescript
import {
  audioService,
  playbackService,
  volumeToDb,
  formatDuration
} from '@/lib/daw-sdk'
```

## Core Services

### Audio Service

Manages audio files and MediaBunny integration:

```typescript
// Load audio file
const info = await audioService.loadAudioFile(file, trackId)
// Returns: { duration, sampleRate, channels, codec, fileName, fileType }

// Load from OPFS
await audioService.loadTrackFromOPFS(trackId, fileName)

// Get audio buffer for playback
const buffer = audioService.getAudioBufferSink(trackId)

// Check if loaded
const isLoaded = audioService.isTrackLoaded(trackId)

// Get track info
const info = audioService.getTrackInfo(trackId)

// Cleanup
await audioService.cleanup()
```

### Playback Service

Manages Web Audio playback with automation:

```typescript
// Initialize with tracks
await playbackService.initializeWithTracks(tracks)

// Start playback
await playbackService.play(tracks, {
  startTime: 0, // seconds
  onTimeUpdate: (time) => {
    console.log('Current time:', time)
  },
  onPlaybackEnd: () => {
    console.log('Playback finished')
  }
})

// Pause
await playbackService.pause()

// Stop (pause + reset to 0)
await playbackService.stop()

// Update volume
playbackService.updateTrackVolume(trackId, 75)

// Update mute
playbackService.updateTrackMute(trackId, true, 75)

// Update solo states
playbackService.updateSoloStates(tracks)

// Stop specific clip
await playbackService.stopClip(trackId, clipId)

// Reschedule after changes
await playbackService.rescheduleTrack(track)

// Sync all tracks
playbackService.synchronizeTracks(tracks)

// Cleanup
await playbackService.cleanup()
```

## Utility Functions

### Volume Utilities

```typescript
import { volumeToDb, dbToVolume, clampDb, getEffectiveGainDb } from '@/lib/daw-sdk'

// Convert percentage to dB
const db = volumeToDb(75) // => -2.5 dB

// Convert dB to percentage
const volume = dbToVolume(-3) // => ~70.8%

// Clamp dB to safe range (-48 to +12)
const safe = clampDb(-60) // => -48

// Get effective gain with automation
const gain = getEffectiveGainDb(trackVolume, automatedGain)
```

### Time Utilities

```typescript
import { formatDuration } from '@/lib/daw-sdk'

formatDuration(65000) // => "1:05"
formatDuration(3600000) // => "1:00:00"
```

### Curve Functions

```typescript
import { evaluateCurve, applyCurveTo } from '@/lib/daw-sdk'

// Evaluate curve at point
const value = evaluateCurve(
  'sCurve', // linear | easeIn | easeOut | sCurve
  0.5,      // progress (0-1)
  0.5       // shape (0-1, default 0.5)
)

// Apply curve to AudioParam
applyCurveTo(
  gainNode.gain,
  'easeOut',
  startValue,
  endValue,
  startTime,
  endTime,
  shape
)
```

### Automation Utilities

```typescript
import {
  countPointsInRange,
  getPointsInRange,
  transferAutomationPoints,
  removeAutomationPointsInRange
} from '@/lib/daw-sdk'

// Count points in time range
const count = countPointsInRange(envelope, startTime, endTime)

// Get points in range
const points = getPointsInRange(envelope, startTime, endTime)

// Transfer points between tracks
const transferredPoints = transferAutomationPoints(
  sourceEnvelope,
  startTime,
  endTime,
  offset
)

// Remove points in range
const updated = removeAutomationPointsInRange(
  envelope,
  startTime,
  endTime
)
```

## React Hooks

### useDAWInitialization

Automatically used in providers. Initializes SDK and handles cleanup:

```typescript
const { isInitialized, error } = useDAWInitialization()
```

### usePlaybackSync

Sync playback time with UI:

```typescript
import { usePlaybackSync } from '@/lib/daw-sdk'

usePlaybackSync(
  isPlaying,
  (time) => setCurrentTime(time),
  [isPlaying]
)
```

### useDragInteraction

Handle drag interactions:

```typescript
import { useDragInteraction } from '@/lib/daw-sdk'

const { isDragging } = useDragInteraction({
  onDragStart: (e) => console.log('Drag started'),
  onDragMove: (e, deltaX, deltaY) => console.log('Dragging'),
  onDragEnd: () => console.log('Drag ended'),
  threshold: 3 // pixels before drag starts
})
```

## Type Validation

Use Zod schemas for runtime validation:

```typescript
import {
  TrackSchema,
  ClipSchema,
  TrackEnvelopeSchema,
  // ... other schemas
} from '@/lib/daw-sdk'

// Validate data
const validated = TrackSchema.parse(unknownData)

// Safe parse
const result = ClipSchema.safeParse(unknownData)
if (result.success) {
  console.log(result.data)
} else {
  console.error(result.error)
}
```

## TypeScript Types

All types are exported:

```typescript
import type {
  Track,
  Clip,
  TrackEnvelope,
  TrackEnvelopePoint,
  PlaybackState,
  TimelineState,
  Tool,
  CurveType,
  // ... all other types
} from '@/lib/daw-sdk'
```

## Error Handling

All async operations can throw:

```typescript
try {
  await audioService.loadAudioFile(file, trackId)
} catch (error) {
  console.error('Failed to load:', error)
  // Handle error
}
```

Services validate inputs and throw descriptive errors:

```typescript
// Invalid track ID
audioService.getAudioBufferSink('nonexistent')
// => throws Error: Track not loaded: nonexistent

// Invalid volume
volumeToDb(-5)
// => throws ZodError: Number must be greater than or equal to 0
```

## Performance Tips

1. **Batch updates**: Group multiple track updates before reschedule
2. **Avoid frequent reloads**: Cache audio buffers
3. **Use proper curve shapes**: Default 0.5 is balanced
4. **Memoize callbacks**: Prevent unnecessary re-schedules
5. **Clean up**: Call cleanup() on unmount

## Advanced Patterns

### Custom Playback Logic

```typescript
// Implement custom playback behavior
class CustomPlayback {
  constructor(private service: typeof playbackService) {}
  
  async playSection(tracks: Track[], start: number, end: number) {
    await this.service.play(tracks, {
      startTime: start,
      onTimeUpdate: (time) => {
        if (time >= end) {
          this.service.pause()
        }
      }
    })
  }
}
```

### Audio Analysis

```typescript
// Access raw audio data
const buffer = audioService.getAudioBufferSink(trackId)
if (buffer) {
  const channelData = buffer.audio.getChannelData(0)
  // Perform analysis
}
```

### Dynamic Automation

```typescript
// Apply automation in real-time
playbackService.play(tracks, {
  onTimeUpdate: (time) => {
    // Calculate automation value at current time
    const gain = calculateGainAtTime(time)
    playbackService.updateTrackVolume(trackId, gain)
  }
})
```

## Troubleshooting

**Audio not playing?**
- Check console for errors
- Verify track has `opfsFileId`
- Ensure audio context is initialized
- Check browser audio permissions

**Automation not working?**
- Verify envelope has points
- Check curve type is valid
- Ensure points are within clip range
- Verify `envelope.enabled` is true

**TypeScript errors?**
- Check you're using correct types from SDK
- Verify imports are from `@/lib/daw-sdk`
- Run `bun typecheck` for details

**Memory leaks?**
- Call `cleanup()` on services
- Use `useDAWInitialization` hook
- Verify no circular references in tracks
