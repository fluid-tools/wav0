# Critical Bugfix Plan - Cross-Track Dragging & Fade UI

## Issues Identified

### 1. **Duplicate Key Error** (Critical)
**Problem**: Clip appears in both tracks during drag, causing React key collision
**Root Cause**: Track updates not batched - clip added to new track before removed from old
**Location**: `daw-track-content.tsx` lines 274-302

**Fix Strategy**:
- Use a single atomic state update for track changes
- Introduce "ghost clip" visual during cross-track drag
- Update both tracks in single `tracksAtom` write
- Add transition state to prevent React key conflicts

### 2. **Fade Handles UI Issues** (High Priority)
**Problems**:
- Re-renders during drag causing jank
- Curve visual offset below clip
- Handle positioning incorrect
- Visual quality needs improvement

**Root Causes**:
- ClipFadeHandles component not optimized (missing memoization)
- SVG viewBox misconfigured for clip dimensions
- Handle positioning uses incorrect parent reference
- Z-index layering issues

**Fix Strategy**:
- Memoize ClipFadeHandles with React.memo
- Fix SVG positioning to be relative to clip bounds
- Improve handle visual design (larger, clearer)
- Add smooth transitions
- Fix curve path to stay within clip bounds

### 3. **Cross-Track Drag Behavior** (Medium Priority)
**Problem**: Need confirmation dialog for automation data transfer

**Fix Strategy**:
- Detect if source clip has automation
- Show dialog: "Move automation with clip?" [Yes] [No] [Cancel]
- If Yes: transfer envelope points with time offset
- If No: move clip only, leave automation on original track
- If Cancel: abort move

### 4. **Clip Duplication vs Move** (Critical)
**Problem**: Dragging duplicates instead of moving

**Root Cause**: Clip added to new track before removal confirmed from old track

**Fix Strategy**:
- Make drag operation atomic
- Use optimistic UI with ghost preview
- Commit on mouse up only
- Rollback on escape

---

## Implementation Order

### Phase 1: Fix Duplicate Key Error (Immediate)
1. Refactor cross-track drag to use single atomic update
2. Add ghost clip visual during drag
3. Batch track updates properly

### Phase 2: Fix Fade Handles UI (Immediate)
1. Memoize ClipFadeHandles component
2. Fix SVG positioning and viewBox
3. Improve handle visual design
4. Add smooth transitions
5. Fix curve path clipping

### Phase 3: Automation Transfer Dialog (Next)
1. Create confirmation dialog component
2. Detect automation on source clip
3. Implement transfer logic
4. Handle time offset for envelope points

### Phase 4: Polish & Testing
1. Test all drag scenarios
2. Verify no duplicate keys
3. Test fade handles at various zoom levels
4. Test automation transfer
5. Performance profiling

---

## Technical Details

### Atomic Track Update Pattern
```typescript
// BEFORE (causes duplicate keys)
_updateTrack(oldTrackId, { clips: oldClips })  // Clip removed
_updateTrack(newTrackId, { clips: newClips })  // Clip added → BOTH exist briefly

// AFTER (atomic)
set(tracksAtom, tracks.map(t => {
  if (t.id === oldTrackId) return { ...t, clips: oldClips }
  if (t.id === newTrackId) return { ...t, clips: newClips }
  return t
}))
```

### Fade Handles Optimization
```typescript
// Memoize component
export const ClipFadeHandles = React.memo(({ ... }) => {
  // Use RAF for drag updates
  // Avoid setState during drag
  // Update via ref and manual DOM manipulation during drag
  // Commit to state on drag end
})
```

### SVG Positioning Fix
```typescript
// Current (wrong)
<svg className="absolute inset-0" viewBox="0 0 100 100">

// Fixed
<svg 
  className="absolute inset-0 pointer-events-none" 
  viewBox="0 0 100 100"
  preserveAspectRatio="none"
  style={{ width: '100%', height: '100%' }}
>
```

---

## Success Criteria

- [ ] No duplicate React key errors
- [ ] Smooth fade handle dragging (60fps)
- [ ] Fade curves visible and properly positioned
- [ ] Cross-track drag shows ghost preview
- [ ] Automation transfer dialog appears when needed
- [ ] Clips move (not copy) between tracks
- [ ] All operations are atomic and reversible
- [ ] No visual glitches or jank

---

Date: 2025-10-02
Priority: Critical - blocks further development

