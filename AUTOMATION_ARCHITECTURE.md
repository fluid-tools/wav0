# WAV0 Automation Architecture

## Single Source of Truth

**Track-Level Automation** (`track.volumeEnvelope`)
- All automation points live on the track, not the clip
- Automation is time-based (milliseconds from project start)
- Clips inherit automation based on their position in time

## Data Flow

```
Track Automation (Source of Truth)
    ↓
    ├─> Automation Lane (Direct Manipulation)
    │   - Context menu changes curve type
    │   - Drag points to adjust time/value
    │   - Double-click to add points
    │
    └─> Clip Drawer (Filtered View)
        - Shows only points within clip time range
        - Changes sync immediately via useEffect
        - Save button applies changes back to track
```

## Synchronization Strategy

1. **Automation Lane → Track**: Direct `updateTrack()` calls (no draft state)
2. **Clip Drawer → Track**: Draft state → `handleEnvelopeSave()` → `updateTrack()`
3. **Track → Clip Drawer**: `useEffect` watches `track.volumeEnvelope` and syncs `envelopeDraft`

## Automation Transfer (Cross-Track Drag)

When moving a clip from Track A → Track B:
1. Count automation points in clip's time range
2. If points exist, show confirmation dialog
3. User choice:
   - **Move**: Transfer points with time offset to Track B, remove from Track A
   - **Leave**: Keep points on Track A
4. If no points, move immediately without dialog

## Clip Fades vs Automation

**Current State**: Separate systems
- Fades: `clip.fadeIn` / `clip.fadeOut` (per-clip gain ramps)
- Automation: `track.volumeEnvelope.points` (track-wide multipliers)

**Proposed Integration** (Future):
- Convert fades to automation points at clip boundaries
- Add "Fades" automation type to track list
- Visible only when automation layer is active

