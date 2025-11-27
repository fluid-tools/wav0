<!-- 7d34574a-1938-46c2-b54f-fc6a733f4fa0 566a3aaa-8572-4efe-a165-c8e809068474 -->
# Fix DAW Storage and Service Registration Bugs

## Verified Bugs

### Bug 1: Sync/Async Storage Inconsistency (storage.ts:28-29 vs 50-51)

The sync path uses truthiness check (`if (stored && ...)`) which filters out empty strings, but the async path uses explicit null checks (`if (value !== null && ...)`). Empty string values would be lost in sync adapters.

**Fix**: Use consistent null checks in both paths: `if (stored !== null && stored !== "undefined")`

### Bug 2: Partial Service Registration (daw-provider.tsx:63-67)

The condition checks `legacyAudioService` but always registers both services. If only audio is provided, `playbackService` is registered as `undefined`.

**Fix**: Only register services that are actually provided.

### Bug 3: Missing Playback-Only Registration (daw-provider.tsx:63)

The condition only checks `legacyAudioService`, so if only `legacyPlaybackService` is provided, no registration happens.

**Fix**: Check if EITHER service exists: `if (!initialRegistrationDone.current && (legacyAudioService || legacyPlaybackService))`

### Bug 4: Storage Adapter Set on Every Render (daw-provider.tsx:72-74)

`setStorageAdapter` is called on every render without guard, causing inefficiency and potential race conditions.

**Fix**: Track the last set adapter with a ref and only call `setStorageAdapter` when it changes.

## Files to Modify

1. [packages/daw-react/src/atoms/storage.ts](packages/daw-react/src/atoms/storage.ts) - Fix sync/async consistency (Bug 1)
2. [packages/daw-react/src/providers/daw-provider.tsx](packages/daw-react/src/providers/daw-provider.tsx) - Fix service registration and storage adapter (Bugs 2-4)

### To-dos

- [ ] Change useDAW hook from useRef to useState pattern
- [ ] Change useDAW hook from useRef to useState pattern
- [ ] Make atomWithStorage load synchronously for sync adapters like browserAdapter
- [ ] Make atomWithStorage load synchronously for sync adapters like browserAdapter
- [ ] Change useDAW hook from useRef to useState pattern
- [ ] Fix sync/async null check consistency in atomWithStorage
- [ ] Fix partial registration, playback-only registration, and storage adapter render issues