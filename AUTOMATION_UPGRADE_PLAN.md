# Production-Ready Automation System Upgrade

## Analysis: Current vs. Target State

### Current Issues
1. **No dB visibility**: Envelope points show raw multipliers (0-400%), not actual dB values
2. **Static volume slider**: Shows base volume, no real-time gain indication
3. **Limited control**: Can't easily adjust volume down (below 100%)
4. **Poor UX**: Text inputs instead of visual, draggable controls
5. **No visual curve preview**: Just numbered points, no graphical representation

### Logic Pro Reference (from screenshots)
1. **Visual automation lane** on track with draggable curve points
2. **dB labels** on automation points (e.g., "-1.4 dB", "0.122")
3. **Curve visualization** overlaid on waveform
4. **Direct manipulation**: Click and drag points, add points by clicking
5. **Real-time feedback**: Current playhead position shows exact dB value
6. **Multiple automation types**: Volume, Pan, Send levels, Plugin params

## Target Architecture

### 1. Track Automation Lane System
```
Track Row (Visual):
├── Waveform Layer (background)
├── Automation Lane (overlay, toggleable)
│   ├── Automation Curve (SVG path)
│   ├── Control Points (draggable)
│   └── Current Value Indicator (at playhead)
└── Clip Regions (foreground)
```

### 2. Dual Volume Display
```
Volume Slider:
├── Base Volume (0-100%, ±0 dB reference)
└── Live Indicator (shows current automated value in dB)

Automation Lane:
├── Shows curve in dB scale (-∞ to +12 dB)
├── Points display: "Time: 0:01.000 → -3.5 dB"
└── Visual curve with proper interpolation
```

### 3. Data Model Enhancement
```typescript
type AutomationPoint = {
  id: string;
  time: number; // ms from track start
  valueDb: number; // dB value (-Infinity to +12)
  curve: "linear" | "easeIn" | "easeOut" | "sCurve";
};

type TrackAutomation = {
  type: "volume" | "pan" | "send" | "plugin";
  paramId?: string; // for plugin automation
  enabled: boolean;
  points: AutomationPoint[];
  visible: boolean; // show/hide lane
};
```

### 4. Conversion Functions
```typescript
// dB ↔ Linear gain
const dbToGain = (db: number) => Math.pow(10, db / 20);
const gainToDb = (gain: number) => 20 * Math.log10(gain);

// Multiplier (0-4) ↔ dB (-∞ to +12 dB)
const multiplierToDb = (mult: number) => {
  if (mult === 0) return -Infinity;
  return 20 * Math.log10(mult);
};

const dbToMultiplier = (db: number) => {
  if (db === -Infinity) return 0;
  return Math.pow(10, db / 20);
};
```

## Implementation Plan

### Phase 1: Data Layer Upgrade
- [x] Add `valueDb` to automation points (keep `value` as multiplier for compatibility)
- [x] Conversion utilities in `lib/audio/volume.ts`
- [x] Update `daw-store.ts` to support dB-based automation

### Phase 2: Visual Automation Lane
- [x] New component: `AutomationLane.tsx` (SVG-based curve renderer)
- [x] Draggable automation points (using Radix UI DnD or native drag)
- [x] Toggle automation view per track
- [x] Overlay on track grid with proper z-indexing

### Phase 3: Enhanced Envelope Editor
- [x] Replace text inputs with hybrid controls:
  - Visual curve preview (mini version)
  - Slider + text input for precise control
  - dB display (primary) with multiplier in muted text
- [x] Add "Insert Point at Playhead" button
- [x] Snap-to-grid for time values
- [x] Visual curve type selector (icons for linear/ease/etc)

### Phase 4: Real-Time Feedback
- [x] "Current Gain" indicator at playhead position
- [x] Live dB meter on volume slider when envelope active
- [x] Update during playback to show animated automation

### Phase 5: Interaction Polish
- [x] Cmd/Ctrl + Click to add automation point
- [x] Delete key to remove selected point
- [x] Drag multiple points (shift-select)
- [x] Copy/paste automation curve
- [x] Undo/redo for automation edits

## Key UX Principles

1. **Direct Manipulation**: Primary editing happens in visual lane, not drawer
2. **dB is King**: All displays show dB, multipliers are implementation detail
3. **Non-Destructive**: Base volume + automation curve (not replacement)
4. **Professional Feel**: Snap, grid alignment, keyboard shortcuts
5. **Progressive Disclosure**: Simple by default, power features available

## Technical Considerations

### Performance
- SVG path rendering for curves (handles zoom gracefully)
- Throttle drag events (60fps cap)
- Virtualize points if > 100 automation points
- Debounce playback engine updates

### Accessibility
- Keyboard navigation for automation points
- Screen reader announcements for value changes
- ARIA labels for all controls
- Focus management in complex interactions

### Data Migration
- Existing `volumeEnvelope.points` with `value` (0-4 multiplier)
- New system uses `valueDb` (-Infinity to +12)
- Migration function: `value` → `multiplierToDb(value)` → `valueDb`
- Backward compatible: if `valueDb` missing, compute from `value`

## Next Steps (Implementation Order)

1. ✅ Add conversion utilities (`lib/audio/volume.ts`)
2. ✅ Update data model with `valueDb` field
3. ✅ Refactor `EnvelopeEditor` to show dB values
4. ✅ Build `AutomationLane` component (visual curve)
5. ✅ Integrate automation lane into track grid
6. ✅ Add real-time playhead indicator
7. ✅ Polish interactions (drag, keyboard, etc)
8. ✅ Test performance with complex projects
9. ✅ Documentation and examples

## Success Criteria

- ✅ Users can see automation curve on track (like Logic Pro)
- ✅ All values displayed in dB (not multipliers)
- ✅ Volume can go down (negative dB) and up (positive dB)
- ✅ Smooth, professional feel for automation editing
- ✅ Real-time feedback during playback
- ✅ Zero performance degradation with automation
- ✅ Accessible via keyboard and screen reader

---

**Vision**: Make WAV0's automation system indistinguishable from Logic Pro in quality, with the added benefit of being web-native and AI-enhanced.

