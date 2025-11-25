<!-- 66ab5906-8a9b-4752-abb8-f49516e8bcc1 6dd6fb16-aafb-44e7-8cbe-1d16aacbe7e0 -->
# Adopt Virtualization for Timeline Grid

## Problem

Current architecture redraws canvas on every scroll event:

- `TimelineGridCanvas` - canvas grid lines
- `TrackGridLines` - canvas grid lines in track area  
- `TimelineGridHeader` - canvas time labels

This causes jank because:

1. Full canvas clear + redraw on every `scrollLeft` change
2. Canvas operations block main thread
3. DPR scaling makes it worse (more pixels to process)

## Solution: Virtualization (like react-timeline-editor)

[react-timeline-editor](https://github.com/xzdarcy/react-timeline-editor) uses `react-virtualized` Grid:

```tsx
<Grid
  columnCount={scaleCount}
  columnWidth={getColumnWidth}
  overscanColumnCount={10}  // Buffer for smooth scrolling
  cellRenderer={cellRenderer}
  scrollLeft={scrollLeft}
/>
```

Key benefits:

- Only renders visible cells + buffer
- DOM elements (divs) - inherently crisp on all displays
- Scroll handling is optimized by the library
- No canvas, no redraw, no DPR issues

## Implementation Plan

### Phase 1: Install Virtualization Library

Add `@tanstack/react-virtual` (modern, actively maintained) or `react-virtualized` (what react-timeline-editor uses).

### Phase 2: Create VirtualizedTimeGrid Component

Replace `TimelineGridCanvas` with virtualized grid:

```tsx
// New: apps/web/components/daw/panels/virtualized-time-grid.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedTimeGrid({ width, height }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [scrollLeft] = useAtom(horizontalScrollAtom)
  const [pxPerMs] = useAtom(timelinePxPerMsAtom)
  const timeGrid = useAtom(cachedTimeGridAtom)[0]
  
  // Each "column" is a grid line at a specific ms position
  const virtualizer = useVirtualizer({
    horizontal: true,
    count: timeGrid.majors.length + timeGrid.minors.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 1, // 1px width per line
    overscan: 20, // Buffer
  })
  
  return (
    <div ref={parentRef} style={{ width, height, overflow: 'hidden' }}>
      <div style={{ width: totalWidth, height, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(item => (
          <div
            key={item.key}
            className="absolute top-0 bottom-0 w-px bg-border/30"
            style={{ left: item.start }}
          />
        ))}
      </div>
    </div>
  )
}
```

### Phase 3: Replace Canvas Components

1. `timeline-grid-canvas.tsx` -> Use VirtualizedTimeGrid
2. `track-grid-lines.tsx` -> Use VirtualizedTimeGrid (shared)
3. `timeline-grid-header.tsx` -> Virtualized labels

### Phase 4: Sync with Existing Scroll

The existing `horizontalScrollAtom` and scroll containers remain unchanged. Virtualization just replaces the rendering layer.

## Files to Modify

1. `apps/web/package.json` - Add @tanstack/react-virtual
2. Create `apps/web/components/daw/panels/virtualized-time-grid.tsx`
3. Create `apps/web/components/daw/panels/virtualized-time-labels.tsx`  
4. Update `apps/web/components/daw/panels/daw-timeline.tsx` - Use new components
5. Update `apps/web/components/daw/panels/track-grid-canvas.tsx` - Use new components

## Alternative: CSS Transform Approach (Simpler)

If virtualization is too complex, a simpler approach:

- Pre-render grid to larger canvas (2x viewport)
- Use CSS `transform: translateX()` for scrolling
- Only redraw when scroll exceeds buffer or zoom changes

This keeps canvas but eliminates per-scroll redraws.

### To-dos

- [ ] Add DPR scaling to timeline-grid-canvas.tsx
- [ ] Add DPR scaling to track-grid-lines.tsx
- [ ] Add DPR scaling to timeline-grid-header.tsx