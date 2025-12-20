# State Management Refactor Plan

## Problem Statement

The `daw-react` atom organization has degraded:

- `base.ts` is 240 lines mixing 8+ unrelated domains
- 21 atoms are defined but never used in any component
- Duplicate state exists (`sectionsAtom` vs `timelineSectionsAtom`)
- Audio loading atoms are obsolete (SDK self-heals)
- Wrapper write atoms add indirection without value

## Goals

1. **Domain-driven organization** - Group atoms by feature/domain
2. **Remove dead code** - Delete 21 unused atoms
3. **Consolidate duplicates** - Single source of truth for each state
4. **Non-breaking migration** - All existing imports continue to work
5. **Improved maintainability** - Clear boundaries, easier navigation

---

## Current Structure Analysis

### `base.ts` (240 lines) - Mixed Concerns

```javascript
- Helpers: createDefaultEnvelope, createDefaultTrack, DEFAULT_TRACK_1
- Core state: tracksAtom, playbackAtom, timelineAtom
- View state: trackHeightZoomAtom, horizontalScrollAtom, verticalScrollAtom, zoomLimitsAtom
- Selection: selectedTrackIdAtom, selectedClipIdAtom
- Inspector: clipInspectorOpenAtom, clipInspectorTargetAtom, eventListOpenAtom
- Tools: activeToolAtom, automationViewEnabledAtom, trackAutomationTypeAtom
- Project: projectNameAtom, projectEndOverrideAtom
- Playhead: playheadDraggingAtom, userIsManuallyScrollingAtom, playheadAutoFollowEnabledAtom, isSeekingAtom
- Audio loading: audioInitializedAtom, audioInitializingAtom (OBSOLETE)
- Derived: tracksCountAtom, selectedClipLoopStateAtom, totalDurationAtom
```



### Dependency Graph (Current)

```javascript
storage.ts, service-registry.ts (foundation)
        │
        ▼
    base.ts ◄──── project.ts
        │              │
        ├──────────────┤
        ▼              ▼
   tracks.ts      timeline.ts     playback.ts
        │                              │
        └──────────┬───────────────────┘
                   ▼
              clips.ts
                   │
                   ▼
                ui.ts ◄── machines/interaction-machine.ts
                   │
                   ▼
               view.ts
```

---

## New Directory Structure

```javascript
packages/daw-react/src/atoms/
├── core/
│   ├── tracks.ts           # tracksAtom, addTrackAtom, updateTrackAtom, removeTrackAtom, etc.
│   ├── playback.ts         # playbackAtom, togglePlaybackAtom, stopPlaybackAtom, etc.
│   └── timeline.ts         # timelineAtom, setTimelineZoomAtom, toggleSnapToGridAtom, etc.
├── audio/
│   └── loading.ts          # initializeAudioFromOPFSAtom, loadAudioFileAtom
├── ui/
│   ├── selection.ts        # selectedTrackIdAtom, selectedClipIdAtom
│   ├── tools.ts            # activeToolAtom, automationViewEnabledAtom, trackAutomationTypeAtom
│   ├── panels.ts           # clipInspectorOpenAtom, clipInspectorTargetAtom, eventListOpenAtom
│   └── interactions.ts     # interactionMachineAtom, clipDragPreviewAtom, resizeInteractionAtom, etc.
├── view/
│   ├── metrics.ts          # timelinePxPerMsAtom, timelineWidthAtom, playheadPositionAtom, etc.
│   └── grid.ts             # cachedTimeGridAtom, snapIntervalMsAtom
├── project/
│   ├── metadata.ts         # projectNameAtom, projectEndOverrideAtom
│   ├── markers.ts          # markersAtom, addMarkerAtom, updateMarkerAtom
│   ├── sections.ts         # timelineSectionsAtom (consolidated)
│   ├── grid-settings.ts    # gridAtom, musicalMetadataAtom
│   └── loop-region.ts      # loopRegionAtom
├── clips/
│   └── clips.ts            # updateClipAtom, removeClipAtom, splitClipAtPlayheadAtom, etc.
├── services/
│   └── registry.ts         # servicesAtom, AudioService, PlaybackService, Services
├── storage/
│   └── atom-with-storage.ts
├── helpers/
│   └── defaults.ts         # createDefaultEnvelope, createDefaultTrack, DEFAULT_TRACK_1
└── index.ts                # Re-exports everything (backwards compatible)
```

---

## Atoms to Remove (21 Total)

### Unused Wrapper Atoms in `ui.ts` (9)

| Atom | Lines | Reason ||------|-------|--------|| `setSelectedTrackAtom` | 33-37 | Wrapper - consumers use `selectedTrackIdAtom` directly || `setSelectedClipAtom` | 40-44 | Wrapper - consumers use `selectedClipIdAtom` directly || `setClipInspectorOpenAtom` | 47-51 | Wrapper - never imported in components || `setClipInspectorTargetAtom` | 54-58 | Wrapper - never imported in components || `setEventListOpenAtom` | 61-63 | Wrapper - never imported in components || `setActiveToolAtom` | 65-67 | Wrapper - never imported in components || `toggleAutomationViewAtom` | 69-72 | Never imported in components || `setTrackAutomationTypeAtom` | 78-84 | Never imported in components || `setProjectNameAtom` | 87-91 | Never imported in components |

### Unused Timeline Section Atoms in `timeline.ts` (3)

| Atom | Lines | Reason ||------|-------|--------|| `addTimelineSectionAtom` | 18-27 | Feature not implemented || `updateTimelineSectionAtom` | 30-40 | Feature not implemented || `removeTimelineSectionAtom` | 43-51 | Feature not implemented |

### Other Unused Atoms in `timeline.ts` (3)

| Atom | Lines | Reason ||------|-------|--------|| `setTimelineScrollAtom` | 61-69 | Wrapper - never imported || `setTimelineGridSizeAtom` | 72-77 | Never imported in components || `deferredZoomAtom` | 120-123 | Never imported anywhere |

### Duplicate/Obsolete in `project.ts` (2)

| Atom | Lines | Reason ||------|-------|--------|| `sectionsAtom` | 16-19 | Duplicate of `timelineSectionsAtom` in base.ts || `removeMarkerAtom` | 76-82 | No delete marker UI exists |

### Obsolete Audio Loading Atoms in `base.ts` (2)

| Atom | Lines | Reason ||------|-------|--------|| `audioInitializedAtom` | 168 | SDK self-heals via `getBufferIterator()` || `audioInitializingAtom` | 169 | No UI loading indicator uses this |

### Related Changes in `tracks.ts` (2)

| Item | Action ||------|--------|| Import of `audioInitializedAtom`, `audioInitializingAtom` | Remove || Usage in `initializeAudioFromOPFSAtom` | Remove state tracking |---

## State Consolidation

### Duplicate: `sectionsAtom` vs `timelineSectionsAtom`

- **Keep**: `timelineSectionsAtom` (storage key: `daw-timeline-sections`)
- **Remove**: `sectionsAtom` (storage key: `daw-project-sections`)
- **Location**: Move to `project/sections.ts`

### Multiple Sources of Truth Pattern (Document, Don't Change)

These are intentional performance optimizations:| Source of Truth | Performance Ref | Purpose ||-----------------|-----------------|---------|| `playbackAtom.isPlaying` | `isPlayingRef.current` | Avoid re-renders in effects || `horizontalScrollAtom` | `scrollRef.current` | RAF-driven scroll sync || `playbackAtom.currentTime` | Transport events | Avoid atom writes at 60fps |---

## Migration Steps

### Phase 1: Create New Structure (Non-Breaking)

**Step 1.1: Create directory scaffolding**

```bash
mkdir -p packages/daw-react/src/atoms/{core,audio,ui,view,project,clips,services,storage,helpers}
```

**Step 1.2: Move atoms domain-by-domain**Order matters to avoid circular deps:

1. `storage/` - Foundation (no deps)
2. `services/` - Foundation (no deps)
3. `helpers/` - Helper functions (SDK deps only)
4. `project/` - Project metadata (storage dep only)
5. `ui/selection.ts` - Selection state (no atom deps)
6. `ui/tools.ts` - Tool state (no atom deps)
7. `ui/panels.ts` - Panel state (no atom deps)
8. `core/tracks.ts` - Track state + write atoms
9. `core/playback.ts` - Playback state + write atoms
10. `core/timeline.ts` - Timeline state + write atoms
11. `clips/` - Clip write atoms (deps on core)
12. `audio/` - Audio loading (deps on core, services)
13. `ui/interactions.ts` - Interaction machine (deps on ui)
14. `view/` - Derived viewport atoms (deps on core, project)

**Step 1.3: Update `index.ts` for backwards compatibility**

```typescript
// Re-export everything from new locations
export * from "./core/tracks";
export * from "./core/playback";
export * from "./core/timeline";
// ... etc

// Keep old exports working (will be same atoms, just re-exported)
```



### Phase 2: Remove Unused Atoms

**Step 2.1: Remove from source files**

- Delete 9 wrapper atoms from `ui.ts`
- Delete 6 atoms from `timeline.ts`
- Delete 2 atoms from `project.ts`
- Delete 2 atoms from `base.ts`

**Step 2.2: Remove audio loading state tracking**

```typescript
// In tracks.ts initializeAudioFromOPFSAtom:
// BEFORE:
set(audioInitializingAtom, true);
// ... load audio ...
set(audioInitializedAtom, true);
set(audioInitializingAtom, false);

// AFTER:
// ... load audio (no state tracking) ...
```

**Step 2.3: Clean up unused imports in web app**

- Remove `_horizontalScroll` unused variables
- Remove any imports of deleted atoms

### Phase 3: Consolidate Duplicates

**Step 3.1: Remove `sectionsAtom` from `project.ts`**

- Keep `timelineSectionsAtom` 
- Update any imports (none expected)

### Phase 4: Verification

**Step 4.1: Build verification**

```bash
bun check-types
bunx turbo build
```

**Step 4.2: Export verification**

- All public exports from `@wav0/daw-react` still work
- No breaking changes to web app imports

---

## File Changes Summary

### New Files (14)

```javascript
atoms/core/tracks.ts
atoms/core/playback.ts
atoms/core/timeline.ts
atoms/audio/loading.ts
atoms/ui/selection.ts
atoms/ui/tools.ts
atoms/ui/panels.ts
atoms/ui/interactions.ts
atoms/view/metrics.ts
atoms/view/grid.ts
atoms/project/metadata.ts
atoms/project/markers.ts
atoms/project/sections.ts
atoms/project/grid-settings.ts
atoms/project/loop-region.ts
atoms/clips/clips.ts
atoms/services/registry.ts
atoms/storage/atom-with-storage.ts
atoms/helpers/defaults.ts
```



### Modified Files (6)

```javascript
atoms/index.ts          # Update to re-export from new locations
atoms/base.ts           # Remove audio loading atoms (can delete file after full migration)
atoms/tracks.ts         # Remove audio loading state tracking
atoms/ui.ts             # Remove 9 wrapper atoms
atoms/timeline.ts       # Remove 6 unused atoms
atoms/project.ts        # Remove sectionsAtom, removeMarkerAtom
```



### Files to Delete (Phase 5 - Future)

After confirming no external consumers, these become redundant:

```javascript
atoms/base.ts           # All atoms moved to new locations
atoms/tracks.ts         # Merged into core/tracks.ts
atoms/clips.ts          # Merged into clips/clips.ts
atoms/playback.ts       # Merged into core/playback.ts
atoms/timeline.ts       # Merged into core/timeline.ts
atoms/ui.ts             # Merged into ui/*
atoms/view.ts           # Merged into view/*
atoms/project.ts        # Merged into project/*
atoms/service-registry.ts # Merged into services/registry.ts
atoms/storage.ts        # Merged into storage/atom-with-storage.ts
```

---

## Estimated Effort

| Phase | Task | Time ||-------|------|------|| 1 | Create new structure, move atoms | 2-3 hours || 2 | Remove 21 unused atoms | 30 minutes || 3 | Consolidate duplicates | 30 minutes || 4 | Verification | 30 minutes || **Total** | | **3.5-4.5 hours** |---

## Success Criteria

1. ✅ All existing `@wav0/daw-react` imports work unchanged
2. ✅ Build passes (`bun check-types`, `bunx turbo build`)
3. ✅ No runtime errors in web app
4. ✅ 21 unused atoms removed
5. ✅ No duplicate state definitions
6. ✅ Clear domain boundaries in atom organization

---

## Related Work

- **SDK Memory Leak Fixes**: Tracked separately in `.cursor/plans/deslop_and_refactor_daw_sdk_015a1499.plan.md`
- `trackStates` Map pruning
- `loadedTracks` Map cleanup
- Sync mutex timeout

---

## Appendix: Atom Inventory by Domain

### Core (Source of Truth)

| Atom | Type | Persisted | Domain ||------|------|-----------|--------|| `tracksAtom` | State | Yes | core/tracks || `playbackAtom` | State | No | core/playback || `timelineAtom` | State | No | core/timeline || `timelineSectionsAtom` | State | Yes | project/sections |

### Selection

| Atom | Type | Persisted | Domain ||------|------|-----------|--------|| `selectedTrackIdAtom` | State | No | ui/selection || `selectedClipIdAtom` | State | No | ui/selection |

### Tools

| Atom | Type | Persisted | Domain ||------|------|-----------|--------|| `activeToolAtom` | State | No | ui/tools || `automationViewEnabledAtom` | State | No | ui/tools || `trackAutomationTypeAtom` | State | No | ui/tools |

### Panels

| Atom | Type | Persisted | Domain ||------|------|-----------|--------|| `clipInspectorOpenAtom` | State | No | ui/panels || `clipInspectorTargetAtom` | State | No | ui/panels || `eventListOpenAtom` | State | No | ui/panels |

### Project

| Atom | Type | Persisted | Domain ||------|------|-----------|--------|| `projectNameAtom` | State | Yes | project/metadata || `projectEndOverrideAtom` | State | Yes | project/metadata || `markersAtom` | State | Yes | project/markers || `gridAtom` | State | Yes | project/grid-settings || `musicalMetadataAtom` | State | Yes | project/grid-settings || `loopRegionAtom` | State | Yes | project/loop-region |

### View (Derived)

| Atom | Type | Source | Domain ||------|------|--------|--------|| `trackHeightZoomAtom` | State | - | view/metrics || `horizontalScrollAtom` | State | - | view/metrics || `verticalScrollAtom` | State | - | view/metrics || `zoomLimitsAtom` | State | - | view/metrics || `timelinePxPerMsAtom` | Derived | timelineAtom | view/metrics || `timelineWidthAtom` | Derived | timelineAtom, totalDurationAtom | view/metrics || `playheadPositionAtom` | Derived | playbackAtom, timelineAtom | view/metrics || `projectEndPositionAtom` | Derived | totalDurationAtom, timelineAtom | view/metrics || `cachedTimeGridAtom` | Derived (cached) | multiple | view/grid || `snapIntervalMsAtom` | Derived | gridAtom, musicalMetadataAtom | view/grid |

### Playhead/Scroll Control

| Atom | Type | Domain ||------|------|--------|| `playheadDraggingAtom` | State | core/playback || `userIsManuallyScrollingAtom` | State | core/playback || `playheadAutoFollowEnabledAtom` | State | core/playback || `isSeekingAtom` | State | core/playback |

### Interactions

| Atom | Type | Domain ||------|------|--------|| `interactionMachineAtom` | State (XState) | ui/interactions || `interactionStateAtom` | Derived | ui/interactions || `interactionContextAtom` | Derived | ui/interactions || `isInteractionActiveAtom` | Derived | ui/interactions || `clipDragPreviewAtom` | Derived | ui/interactions || `resizeInteractionAtom` | Derived | ui/interactions || `loopDragInteractionAtom` | Derived | ui/interactions || `clipMoveHistoryAtom` | State | ui/interactions |

### Services