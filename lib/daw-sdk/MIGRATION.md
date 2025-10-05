# DAW SDK Migration Guide

## Quick Start

The SDK is now automatically initialized via `useDAWInitialization` hook in the app providers. **No manual initialization needed.**

## Step-by-Step Migration

### 1. Update Imports ✅ (DONE)

**Before:**
```typescript
import { audioManager } from '@/lib/audio/audio-manager'
import { playbackEngine } from '@/lib/audio/playback-engine'
```

**After:**
```typescript
import { audioService, playbackService } from '@/lib/daw-sdk'
```

### 2. Type Imports ✅ (DONE)

Types are re-exported from daw-store.ts for backward compatibility. You can optionally use the SDK types:

```typescript
// Current (still works)
import type { Track, Clip } from '@/lib/state/daw-store'

// New (optional, with validation)
import { TrackSchema, ClipSchema } from '@/lib/daw-sdk'
const validated = TrackSchema.parse(data)
```

### 3. Service Method Mapping

| Old (audio-manager.ts) | New (audioService) |
|------------------------|-------------------|
| `loadAudioFile(file, id)` | `loadAudioFile(file, id)` |
| `loadTrackFromOPFS(id, name)` | `loadTrackFromOPFS(id, name)` |
| `getAudioBufferSink(id)` | `getAudioBufferSink(id)` |
| `getTrackInfo(id)` | `getTrackInfo(id)` |
| `isTrackLoaded(id)` | `isTrackLoaded(id)` |

| Old (playback-engine.ts) | New (playbackService) |
|--------------------------|----------------------|
| `play(tracks, options)` | `play(tracks, options)` |
| `pause()` | `pause()` |
| `stop()` | `stop()` |
| `synchronizeTracks(tracks)` | `synchronizeTracks(tracks)` |
| `rescheduleTrack(track)` | `rescheduleTrack(track)` |
| `updateTrackVolume(id, vol)` | `updateTrackVolume(id, vol)` |
| `updateTrackMute(id, muted)` | `updateTrackMute(id, muted)` |
| `updateSoloStates(tracks)` | `updateSoloStates(tracks)` |
| `stopClip(trackId, clipId)` | `stopClip(trackId, clipId)` |

**All method signatures are identical - just swap the imports!**

### 4. Utilities

| Old Location | New Location |
|-------------|-------------|
| `@/lib/storage/opfs` → `formatDuration()` | `@/lib/daw-sdk` |
| `@/lib/audio/volume` → `volumeToDb()` | `@/lib/daw-sdk` |
| `@/lib/audio/curve-functions` → `evaluateCurve()` | `@/lib/daw-sdk` |
| `@/lib/utils/automation-utils` → `getPointsInRange()` | `@/lib/daw-sdk` |

**Example:**
```typescript
// Before
import { formatDuration } from '@/lib/storage/opfs'
import { volumeToDb } from '@/lib/audio/volume'

// After
import { formatDuration, volumeToDb } from '@/lib/daw-sdk'
```

## What Changed in daw-store.ts

**All service imports updated:**
```typescript
// OLD: import { audioManager } from "@/lib/audio/audio-manager";
// OLD: import { playbackEngine } from "@/lib/audio/playback-engine";

// NEW: import { audioService, playbackService } from "@/lib/daw-sdk";
```

**All method calls updated:**
- `audioManager.loadAudioFile()` → `audioService.loadAudioFile()`
- `playbackEngine.play()` → `playbackService.play()`
- etc.

**Types remain unchanged** - still exported from daw-store.ts for compatibility.

## App Initialization

The SDK is automatically initialized in `lib/state/providers.tsx`:

```typescript
import { useDAWInitialization } from '@/lib/daw-sdk'

function DAWInitializer({ children }) {
  const { isInitialized, error } = useDAWInitialization()
  
  if (error) return <ErrorScreen error={error} />
  if (!isInitialized) return <LoadingScreen />
  
  return <>{children}</>
}
```

This ensures:
- ✅ Audio context is initialized before use
- ✅ Resources are cleaned up on unmount
- ✅ User sees loading state during initialization
- ✅ Errors are caught and displayed

## Benefits

1. **Zero Breaking Changes**: All APIs are identical
2. **Automatic Initialization**: No manual setup needed
3. **Better Error Handling**: Initialization errors caught gracefully
4. **Memory Management**: Automatic cleanup on unmount
5. **Type Safety**: Optional Zod validation available
6. **Modular**: Clean SDK structure

## Files Changed

### Core Files ✅
- [x] `lib/state/daw-store.ts` - Updated all service imports
- [x] `lib/state/providers.tsx` - Added DAW initialization
- [x] `lib/daw-sdk/hooks/use-daw-initialization.ts` - New initialization hook

### SDK Files ✅
- [x] All SDK files created and documented
- [x] Backward compatible exports
- [x] Full Zod validation available

### To Migrate (Optional)
- [ ] Update component imports to use SDK directly (optional)
- [ ] Add Zod validation at component boundaries (optional)
- [ ] Use consolidated hooks instead of useEffect (optional)

## Testing

1. **Test initialization:**
```bash
bun dev
# Should see "[DAW SDK] Initialized successfully" in console
```

2. **Test audio loading:**
- Import an audio file in the DAW
- Should work identically to before

3. **Test playback:**
- Play/pause/stop should work as before
- Automation should work as before
- Multi-clip playback should work as before

## Rollback Plan

If issues arise, the old files still exist:
- `lib/audio/audio-manager.ts`
- `lib/audio/playback-engine.ts`

Simply revert the imports in `daw-store.ts` to roll back.

## Questions?

Refer to:
- `lib/daw-sdk/README.md` - Full API documentation
- `lib/daw-sdk/ARCHITECTURE.md` - Deep dive
- `REFACTOR_PLAN.md` - Migration overview
