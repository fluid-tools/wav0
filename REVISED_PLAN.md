# Revised Implementation Plan - DAW Features & Improvements

**Date**: 2025-10-02  
**Status**: Ready to proceed

---

## ✅ Completed (All Critical Bugs Fixed)

### Phase 1: Core Bugfixes
1. ✅ **Duplicate React Key Error** - Atomic state updates for cross-track dragging
2. ✅ **Fade Handles Re-render Jank** - Memoization + delta-based dragging
3. ✅ **Fade UI Visual Issues** - SVG positioning, handle design, accessibility
4. ✅ **Scroll Lock** - Both document-level and grid pan lock for fade handles
5. ✅ **Linter & Type Errors** - Zero errors, full compliance

**Result**: Production-ready, 60fps interactions, professional UX

---

## 🎯 Next Priority Features (In Order)

### Priority 1: Grid Time Sections (In Progress - 50%)
**Goal**: Allow users to create named time sections (Verse, Chorus, Bridge, etc.) in the timeline

**State Management**: ✅ Complete
- `TimelineSection` type defined
- `timelineSectionsAtom` state atom
- CRUD atoms: `addSectionAtom`, `updateSectionAtom`, `removeSectionAtom`

**Remaining Work**:
1. **Timeline Section Markers Component**
   - Render section markers above timeline
   - Show section name and duration
   - Color-coded visual design

2. **Section Creation UI**
   - Method 1: Click + drag on timeline to define boundaries
   - Method 2: Right-click menu "Add Section Here"
   - Method 3: Keyboard shortcut (Cmd+Shift+S)

3. **Section Editing**
   - Double-click to rename
   - Drag edges to resize
   - Drag body to move
   - Right-click for context menu (Rename, Change Color, Delete)

4. **Visual Overlay on Grid**
   - Semi-transparent colored regions
   - Section name label at top
   - Subtle grid lines at boundaries

5. **Preset Section Names**
   - Dropdown: Verse, Chorus, Bridge, Pre-Chorus, Hook, Intro, Outro
   - Custom names also supported

**Estimated Time**: 2-3 hours

---

### Priority 2: Automation Transfer Dialog
**Goal**: When dragging clips cross-track, detect automation and confirm transfer

**Implementation**:
1. **Detection Logic**
   ```typescript
   const hasAutomation = (clip: Clip, track: Track) => {
     return track.volumeEnvelope?.enabled && 
            track.volumeEnvelope.points.length > 0;
   };
   ```

2. **Dialog Component**
   - Show when cross-track drag detected + automation exists
   - Options: "Move automation with clip?" [Yes] [No] [Cancel]
   - Use Radix Dialog or Alert Dialog

3. **Transfer Logic**
   ```typescript
   if (transferAutomation) {
     // Calculate time offset
     const timeOffset = newClip.startTime - oldClip.startTime;
     
     // Transfer envelope points with offset
     const transferredEnvelope = {
       ...sourceTrack.volumeEnvelope,
       points: sourceTrack.volumeEnvelope.points.map(p => ({
         ...p,
         time: p.time + timeOffset
       }))
     };
     
     // Apply to new track
     updateTrack(newTrack.id, { volumeEnvelope: transferredEnvelope });
     
     // Optional: Clear from old track
     updateTrack(oldTrack.id, { volumeEnvelope: defaultEnvelope });
   }
   ```

**Estimated Time**: 1-2 hours

---

### Priority 3: Pan Automation
**Goal**: Add panning automation lane (extends existing volume automation system)

**Implementation**:
1. **Add Pan State to Track**
   ```typescript
   type Track = {
     // ... existing
     pan: number; // -100 (left) to 100 (right), default 0
     panEnvelope?: TrackEnvelope; // Same structure as volumeEnvelope
   };
   ```

2. **UI in Track List**
   - Add pan slider below volume slider
   - Range: -100 to 100
   - Label: "L" (left), "C" (center), "R" (right)
   - Automation indicator (amber dot) when panEnvelope active

3. **Pan Automation Lane**
   - Duplicate `AutomationLane` component as `PanAutomationLane`
   - Use same point/curve system
   - Visual: Different color (e.g., purple vs amber)

4. **Playback Engine Integration**
   - Create stereo panner node in AudioContext
   - Apply pan automation via `panNode.pan.value`
   - Gain chain: source → clipGain → envelopeGain → panNode → muteSoloGain → master

5. **Clip Editor Drawer**
   - Add "Pan" section similar to "Volume Envelope"
   - Same point editing UI

**Estimated Time**: 3-4 hours

---

### Priority 4: Copy/Paste Automation
**Goal**: Shift-click automation points to select/copy/paste

**Implementation**:
1. **Selection State**
   ```typescript
   const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
   ```

2. **UI Interactions**
   - Shift+Click: Toggle point selection
   - Cmd+A: Select all points
   - Visual: Selected points larger + different color

3. **Copy/Paste**
   - Cmd+C: Copy selected points to clipboard
   - Cmd+V: Paste at playhead position (time-shifted)
   - Preserve relative timing and curve types

4. **Smart Loop Behavior**
   - **Pre-loop automation** (before clip loops):
     - Auto-copy to all loop iterations
     - User can disable via checkbox
   
   - **Post-loop automation** (after clip starts looping):
     - Manual copy/paste only
     - Prevents accidental overwrites

**Estimated Time**: 2-3 hours

---

### Priority 5: OPFS Visibility UI
**Goal**: Provide UI to view and manage OPFS storage

**Implementation**:
1. **Storage Stats Component**
   - Show total storage used
   - Show available storage
   - Show per-file breakdown

2. **File List**
   - Table: Filename, Size, Duration, Date Added
   - Actions: Preview, Delete, Export

3. **OPFS Utilities**
   ```typescript
   const getStorageStats = async () => {
     const estimate = await navigator.storage.estimate();
     return {
       used: estimate.usage,
       available: estimate.quota,
       percentage: (estimate.usage / estimate.quota) * 100
     };
   };
   
   const listOPFSFiles = async () => {
     const root = await navigator.storage.getDirectory();
     const entries = [];
     for await (const entry of root.values()) {
       entries.push(entry);
     }
     return entries;
   };
   ```

4. **UI Location**
   - Add to toolbar: "Storage" button
   - Opens Sheet component
   - Show storage bar + file list

**Estimated Time**: 2-3 hours

---

### Priority 6: High-Quality Sliders (TanStack Ranger - Optional)
**Goal**: Evaluate if TanStack Ranger provides precision benefits for DAW sliders

**Evaluation Criteria**:
1. Does it improve precision over native `<input type="range">`?
2. Does it support fine-tuning (Shift+drag for small increments)?
3. Does it work well with automation (smooth curves)?
4. Is bundle size acceptable?
5. Does it match our visual design?

**Decision Process**:
1. Install `@tanstack/react-ranger`
2. Create prototype volume slider
3. Compare with existing slider
4. If benefits exist → implement for all DAW controls
5. If no clear benefit → keep current implementation

**Estimated Time**: 1-2 hours (evaluation only)

---

## Total Estimated Time
- Grid Time Sections: 2-3 hours
- Automation Transfer Dialog: 1-2 hours
- Pan Automation: 3-4 hours
- Copy/Paste Automation: 2-3 hours
- OPFS Visibility: 2-3 hours
- Slider Evaluation: 1-2 hours

**Total**: ~11-17 hours of focused development

---

## Success Metrics
- [ ] All features implemented and tested
- [ ] Zero console errors/warnings
- [ ] 60fps interactions maintained
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] Professional UX matching Logic Pro quality
- [ ] Comprehensive documentation

---

## Next Steps
1. Complete Grid Time Sections (highest priority, already started)
2. Test all features together for integration issues
3. Performance profiling and optimization
4. User acceptance testing
5. Production deployment

---

**Status**: Ready to implement Priority 1 (Grid Time Sections)  
**Blockers**: None - all critical bugs resolved


