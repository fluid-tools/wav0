<!-- 6b58ac9d-607a-48e8-9903-74ae875f32fe bf103c39-52ee-449a-8789-3bb4ed9b3d07 -->
# WAV0 DAW Architecture Analysis and Migration Status

## Current Layer Architecture

### Layer 1: `@wav0/daw-sdk` (Pure TypeScript Primitives)

**Purpose**: Framework-agnostic core - types, utilities, and audio engine primitives.

**Contents**:

- **Types**: `Track`, `Clip`, `PlaybackState`, `TimelineState`, etc. (Zod schemas)
- **Utils**: `automation`, `curves`, `time`, `volume` namespaces
- **Core Classes**: `Transport`, `AudioEngine`, `DAW` facade, `OPFSManager`
- **Constants**: Scheduling tolerances, visual scale factors

**Design Principle**: Pure functions and classes with no React/framework dependencies. Could be used with Vue, Svelte, or vanilla JS.

### Layer 2: `@wav0/daw-react` (React Bindings)

**Purpose**: React-specific state management and hooks that compose SDK primitives.

**Contents**:

- **Atoms**: All Jotai atoms (`tracksAtom`, `playbackAtom`, `timelineAtom`, view/ui/timeline atoms)
- **Hooks**: `useClipInspector`, `useTimebase`, `useDragInteraction`, `useLiveAutomationGain`, `usePlaybackSync`
- **Bridges**: `PlaybackServiceBridge`, `AudioServiceBridge` (wrap legacy services with SDK calls)
- **Provider**: `DAWProvider` (context for bridges and SDK instance)

**Design Principle**: Composes SDK primitives into React-friendly APIs. Atoms are the source of truth.

### Layer 3: `apps/web/components/daw/` (UI Components)

**Purpose**: Visual components that render state and dispatch mutations.

**Current Reality**: Components import from `@/lib/daw-sdk` (legacy shim) which re-exports from `@wav0/daw-react`.

---

## Migration Status

### What Has Been Migrated

| Area | From | To | Status |

|------|------|----|----|

| Atoms | `lib/daw-sdk/state/*.ts` | `daw-react/atoms/*.ts` | DONE - re-exported via shim |

| Hooks | `lib/daw-sdk/hooks/*.ts` | `daw-react/hooks/*.ts` | DONE - re-exported via shim |

| Utils | `lib/daw-sdk/utils/` | `daw-sdk/utils/` | DONE - `automation`, `time`, `volume`, `curves` |

| Types | `lib/daw-sdk/types/` | `daw-sdk/types/` | DONE |

| Transport | N/A (new) | `daw-sdk/core/transport.ts` | DONE - SDK-first playback |

| AudioEngine | N/A (new) | `daw-sdk/core/audio-engine.ts` | DONE - MediaBunny wrapper |

| Bridges | N/A (new) | `daw-react/bridges/` | DONE - wrap legacy with SDK |

### What Remains in Legacy (`apps/web/lib/daw-sdk/`)

| Component | Why Still Needed | Removal Blocker |

|-----------|------------------|-----------------|

| `PlaybackService` | Full clip scheduling, automation curves, rescheduleTrack | SDK Transport lacks `rescheduleTrack` during playback |

| `AudioService` | OPFS management, buffer loading | Used by PlaybackService internally |

| `EncodeService` | WAV encoding for export | No SDK equivalent |

| `RenderService` | Offline rendering | No SDK equivalent |

| `PreviewPlayer` | Preview playback in clip inspector | No SDK equivalent |

| `automation-migration-helpers.ts` | `computeAutomationTransfer`, `shiftTrackAutomationInRange` | Used by `daw-track-content.tsx` |

### Direct Legacy Service Usage in Components

Files still calling `playbackService.` directly:

- `apps/web/components/daw/panels/daw-track-content.tsx` (3 calls)
- `apps/web/components/daw/panels/daw-track-list.tsx` (1 call)
- `apps/web/components/daw/controls/master-meter.tsx` (1 call)

---

## Component Dependency Flow

```
apps/web/components/daw/
    ├── imports from "@/lib/daw-sdk" (shim)
    │       ↓
    │   re-exports from "@wav0/daw-react"
    │       ↓
    │   atoms, hooks, bridges
    │       ↓
    │   compose "@wav0/daw-sdk" primitives
    │
    └── also imports legacy services directly
            ↓
        PlaybackService, AudioService (singletons)
```

---

## To Fully Remove `apps/web/lib/daw-sdk/`

### Phase 1: SDK Feature Completion (required)

1. Add `rescheduleTrack(track, allTracks)` to SDK Transport - mid-playback clip updates
2. Add offline rendering capability to SDK
3. Add WAV encoding to SDK
4. Add preview player to SDK

### Phase 2: Eliminate Direct Service Calls

1. Route all `playbackService.` calls through `useBridgeMutations()` hook
2. Add missing bridge methods for reschedule, render, encode
3. Update `daw-track-content.tsx`, `daw-track-list.tsx`, `master-meter.tsx`

### Phase 3: Update Import Paths

1. Change 26 component imports from `@/lib/daw-sdk` to `@wav0/daw-react`
2. Import SDK types/utils from `@wav0/daw-sdk` directly

### Phase 4: Delete Legacy

1. Remove `apps/web/lib/daw-sdk/` directory
2. Remove shim re-exports

---

## Future: Effect TS Integration Strategy

The current architecture aligns well with Effect patterns:

**SDK Layer** (pure):

- `automation.evaluateEnvelopeGainAt()` → becomes Effect pipe with error channel
- `Transport.play()` → becomes Effect with interruption, retry
- Types become Effect Schemas instead of Zod

**React Layer**:

- Atoms remain Jotai (Effect has no equivalent)
- Hooks wrap Effect services with React lifecycle
- Bridges become Effect layers

**Compositional Pattern**:

```typescript
// Future: Effect service composition
const PlaybackService = Effect.gen(function*() {
  const transport = yield* Transport;
  const audioEngine = yield* AudioEngine;
  // ... compose primitives
});
```

---

## Summary

**Done**: Core primitives, atoms, hooks, bridges, types, utils

**Blocking Full Migration**:

1. `rescheduleTrack` in SDK Transport
2. Render/encode services
3. 5 direct service calls in components

**Architecture Goal**: `apps/web` only has components. All logic lives in SDK (pure) or React package (state/hooks).

### To-dos

- [ ] Delete apps/web/lib/daw-sdk directory