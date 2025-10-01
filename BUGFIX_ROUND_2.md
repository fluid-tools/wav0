# Bug Fixes Round 2

## Issues Resolved

### 1. Drawer Scroll Not Working ✅

**Root Cause**: Missing explicit height constraint. Vaul drawer applies conditional `max-h-[80vh]` but flex layout needs explicit height for ScrollArea to work.

**Fix**:
```tsx
// Before
<DrawerContent className="flex max-h-[90vh] flex-col overflow-hidden">
  <ScrollArea className="flex-1 overflow-hidden px-4">

// After  
<DrawerContent className="flex h-[80vh] flex-col">
  <div className="flex-1 overflow-hidden">
    <ScrollArea className="h-full px-4">
```

**Changes**:
- Explicit `h-[80vh]` on DrawerContent
- Wrapper `div` with `flex-1 overflow-hidden` around ScrollArea
- ScrollArea gets `h-full` to fill parent
- Added border separators to header/footer

**File**: `components/daw/inspectors/clip-editor-drawer.tsx`

---

### 2. Volume Slider "Stuck" During Envelope Automation ✅

**Root Cause**: **Not a bug** - this is correct behavior. The slider shows BASE volume, envelope multiplies it dynamically. User confusion: slider appears "stuck" when envelope is automating gain.

**Solution**: UI clarity improvements

**Changes**:
1. **Amber dot indicator** (●) next to volume label when envelope is active
2. **Tooltips**:
   - Slider: "Base volume: X dB (envelope active)"
   - Label: "Base level · envelope shapes curve"
3. Visual feedback that envelope is modulating the base value

**Architecture Reminder**:
```
Base Volume (slider) × Envelope Multiplier (automation) = Final Gain
      ↓                          ↓                           ↓
  envelopeGainNode          point.value              muteSoloGainNode
```

The slider is the **primary control** - it sets the base level. Envelope shapes the curve relative to that base.

**File**: `components/daw/panels/daw-track-list.tsx`

---

### 3. Dynamic Duration Formatting (Logic Pro Style) ✅

**Requirement**: Adaptive precision based on zoom level
- Zoomed in: show milliseconds (0:04.123)
- Medium zoom: show deciseconds (0:04.1)  
- Zoomed out: just seconds (0:04)

**Implementation**:
```typescript
export function formatDuration(
  durationMs: number,
  options: {
    precision?: "auto" | "ms" | "deciseconds" | "seconds";
    pxPerMs?: number; // For auto precision
  } = {},
): string
```

**Auto Precision Logic**:
- `pxPerMs >= 0.5` → milliseconds (very zoomed in)
- `pxPerMs >= 0.1` → deciseconds (medium zoom)
- `pxPerMs < 0.1` → seconds (zoomed out)

**Usage**:
```tsx
{formatDuration(clip.trimEnd - clip.trimStart, { pxPerMs: pixelsPerMs })}
```

**Files**: 
- `lib/storage/opfs.ts` (formatDuration function)
- `components/daw/panels/daw-track-content.tsx` (clip duration display)

---

## Testing Checklist

- [ ] Open clip drawer, verify smooth scrolling with many envelope points
- [ ] Enable envelope on track, adjust points during playback
- [ ] Verify volume slider shows amber dot when envelope active
- [ ] Hover over volume slider/label to see tooltips
- [ ] Zoom in/out on timeline, verify duration precision adapts:
  - Very zoomed in: "0:04.123"
  - Medium zoom: "0:04.1"
  - Zoomed out: "0:04"
- [ ] Adjust base volume slider, envelope should multiply that base

---

## Architecture Notes

### Volume Control Flow
```
Track Volume Slider (0-100)
    ↓
Base Volume (0-1) = volume / 100
    ↓
EnvelopeGainNode.gain = baseVolume × envelope.point.value
    ↓
MuteSoloGainNode.gain = 0 (muted) or 1 (active)
    ↓
Master → Speakers
```

**Key Insight**: Slider is NOT "stuck" - it represents the base level. The envelope is a multiplier that shapes the curve. Both work together, not duplicated state.

---

Date: 2025-10-01  
Status: All issues resolved, ready to test


