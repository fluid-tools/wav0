# Fade Handles Improvement Plan

## Current Issues

### 1. **Accidental Drag to 0ms** (Critical UX Issue)
**Problem**: Users can accidentally reduce fade to 0ms, making it disappear
**Impact**: Confusing - fade handles vanish, hard to re-enable

### 2. **Visual Inconsistency**
- Handles only visible when fade > 0
- No visual indicator when fade = 0
- Handle width too thin (1px)
- Opacity changes confusing

### 3. **Interaction Issues**
- No snap-to-zero threshold
- No minimum fade duration
- Drag direction inverted for fadeOut (feels unnatural)
- No visual feedback during drag

### 4. **Missing Features**
- No double-click to reset/remove
- No keyboard shortcuts
- No fine-tuning (Shift+drag for precision)
- No fade type selection (linear/exponential/logarithmic)

---

## Proposed Improvements

### Priority 1: Prevent Accidental Zero (CRITICAL)
1. **Minimum fade duration**: 10ms (prevents total removal)
2. **Snap-to-zero zone**: Last 50ms snaps to minimum with haptic feedback
3. **Always-visible handles**: Show placeholder handles even when fade = 0
4. **Visual indicators**: Grey/disabled state for no-fade

### Priority 2: Improved Visual Design
1. **Wider handles**: 3-4px instead of 1px (easier to grab)
2. **Better contrast**: More visible handles
3. **Hover states**: Clear affordance
4. **Drag preview**: Real-time duration tooltip
5. **Color-coded**: Fade-in = green tint, Fade-out = red tint

### Priority 3: Better Interaction
1. **Consistent drag direction**: Both handles drag left/right naturally
2. **Fine-tuning**: Hold Shift for 10x slower drag (precision)
3. **Snap to grid**: Option to snap fade to timeline grid
4. **Double-click**: Reset to default (100ms) or remove
5. **Escape key**: Cancel drag and revert

### Priority 4: Advanced Features
1. **Fade curve types**: Linear (default), Exponential, Logarithmic, S-Curve
2. **Context menu**: Right-click for fade options
3. **Presets**: Quick presets (Fast/Medium/Slow fade)
4. **Copy/paste**: Copy fade settings between clips

---

## Implementation Plan

### Phase 1: Fix Accidental Zero (NOW)
```typescript
const MIN_FADE_MS = 10; // Minimum fade duration
const SNAP_THRESHOLD_MS = 50; // Snap to min when < this

const handleFadePointerMove = useCallback((e: React.PointerEvent) => {
  if (!draggingFade) return;
  
  const deltaX = e.clientX - dragStartXRef.current;
  const deltaMs = deltaX / pixelsPerMs;
  
  let newFadeMs = dragStartValueRef.current + deltaMs;
  
  // Clamp to range
  newFadeMs = Math.max(0, Math.min(newFadeMs, maxFadeMs));
  
  // Snap to minimum if close to zero
  if (newFadeMs > 0 && newFadeMs < SNAP_THRESHOLD_MS) {
    newFadeMs = MIN_FADE_MS;
  }
  
  onFadeChange(clip.id, draggingFade, Math.round(newFadeMs));
}, [draggingFade, clip.id, pixelsPerMs, maxFadeMs, onFadeChange]);
```

### Phase 2: Enhanced Visuals (NOW)
```typescript
// Always render handles, even at 0
const renderHandle = (fade: "fadeIn" | "fadeOut") => {
  const fadeValue = clip[fade] ?? 0;
  const fadePx = fadeValue * pixelsPerMs;
  const hasNoFade = fadeValue === 0;
  
  return (
    <button
      className={cn(
        "absolute top-0 bottom-0 w-1 cursor-ew-resize",
        "bg-primary hover:bg-primary/90 transition-all",
        "focus:outline-none focus-visible:ring-2",
        hasNoFade && "opacity-30 border-2 border-dashed border-primary",
        draggingFade === fade && "scale-x-150 opacity-100"
      )}
      style={{
        [fade === "fadeIn" ? "left" : "right"]: fadePx,
        width: hasNoFade ? "8px" : "3px" // Wider when no fade
      }}
    >
      {/* Tooltip during drag */}
      {draggingFade === fade && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 
                        bg-popover text-popover-foreground px-2 py-1 
                        rounded text-xs whitespace-nowrap shadow-lg">
          {formatDuration(fadeValue)}
        </div>
      )}
    </button>
  );
};
```

### Phase 3: Precision Controls (NEXT)
```typescript
const handleFadePointerMove = useCallback((e: React.PointerEvent) => {
  if (!draggingFade) return;
  
  const deltaX = e.clientX - dragStartXRef.current;
  
  // Fine-tuning: 10x slower when Shift is held
  const multiplier = e.shiftKey ? 0.1 : 1;
  const deltaMs = (deltaX / pixelsPerMs) * multiplier;
  
  // ... rest of logic
}, [draggingFade, pixelsPerMs, /* ... */]);
```

### Phase 4: Advanced Features (FUTURE)
- Fade curve type selector (Linear/Exp/Log/S-Curve)
- Right-click context menu with presets
- Keyboard shortcuts (F for fade, Shift+F for fade out)

---

## Visual Design Specification

### Handle States
```css
/* No fade (placeholder) */
.handle-none {
  width: 8px;
  opacity: 0.3;
  border: 2px dashed var(--primary);
  background: transparent;
}

/* Has fade (normal) */
.handle-active {
  width: 3px;
  opacity: 0.7;
  background: var(--primary);
}

/* Hover */
.handle-hover {
  width: 4px;
  opacity: 0.9;
  background: var(--primary);
  box-shadow: 0 0 8px var(--primary);
}

/* Dragging */
.handle-dragging {
  width: 4px;
  opacity: 1;
  background: var(--primary-foreground);
  box-shadow: 0 0 12px var(--primary);
}
```

### Overlay Gradients
```css
/* Fade In - Green tint */
.fade-in-overlay {
  background: linear-gradient(
    to right,
    rgba(34, 197, 94, 0.2),  /* green-500 */
    transparent
  );
}

/* Fade Out - Red tint */
.fade-out-overlay {
  background: linear-gradient(
    to left,
    rgba(239, 68, 68, 0.2),  /* red-500 */
    transparent
  );
}
```

---

## Testing Checklist

### Functional
- [ ] Cannot drag fade to exactly 0 (minimum 10ms)
- [ ] Snaps to minimum when < 50ms
- [ ] Handles visible even with no fade
- [ ] Shift+drag for fine-tuning works
- [ ] Double-click resets/removes fade
- [ ] Escape cancels drag
- [ ] Tooltip shows during drag
- [ ] Max fade still 50% of clip

### Visual
- [ ] Handles clearly visible on all backgrounds
- [ ] Hover states work
- [ ] Drag states work
- [ ] Color-coding distinguishes in/out
- [ ] Tooltip readable and positioned well

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] ARIA labels accurate
- [ ] Screen reader friendly

### Performance
- [ ] No jank during drag
- [ ] Smooth transitions
- [ ] Scroll lock works
- [ ] 60fps maintained

---

**Next Steps**: Implement Phase 1 & 2 immediately

