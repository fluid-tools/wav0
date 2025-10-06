# DAW Component Architecture

Clean, modular architecture for the WAV0 DAW interface.

## Directory Structure

```
components/daw/
├── index.ts                  # Public API - clean imports
├── daw-container.tsx         # Main orchestrator
├── unified-overlay.tsx       # Global overlays
├── panels/                   # Grid, timeline, tracks
│   ├── daw-timeline.tsx
│   ├── daw-track-list.tsx
│   ├── daw-track-content.tsx
│   └── audio-test-panel.tsx
├── controls/                 # Transport, toolbar, shortcuts
│   ├── daw-controls.tsx
│   ├── daw-toolbar.tsx
│   └── global-shortcuts.tsx
├── inspectors/               # Clip & envelope editors
│   ├── clip-inspector-sheet.tsx
│   ├── envelope-editor.tsx
│   └── inspector-section.tsx
└── context-menus/            # Right-click menus
    ├── clip-context-menu.tsx
    └── track-context-menu.tsx
```

## Usage

```tsx
// Clean import from index
import { DAWContainer } from "@/components/daw";

// Or granular imports
import { 
  DAWTimeline, 
  DAWControls, 
  ClipInspectorSheet 
} from "@/components/daw";
```

## State Management

- **Jotai atoms**: `lib/state/daw-store.ts`
- **Playback engine**: `lib/audio/playback-engine.ts`
- **Custom hooks**: `lib/hooks/use-clip-inspector.ts`

## Key Principles

1. **Composability**: Small, focused components
2. **Clean imports**: Barrel exports via `index.ts`
3. **Separation of concerns**: UI in components, logic in hooks/lib
4. **Accessibility**: ARIA labels, keyboard nav, focus management
5. **Performance**: React.memo, useMemo, useCallback where needed

## Accessibility

- All interactive elements have `aria-label`
- Keyboard shortcuts via `global-shortcuts.tsx`
- Focus management in modals/sheets
- Semantic HTML (buttons, labels, inputs)
- Screen reader support via sr-only text

## Adding New Components

1. Place in appropriate subfolder (panels/controls/inspectors)
2. Export from `index.ts`
3. Add custom hook to `lib/hooks/` if logic is complex
4. Document props with JSDoc
5. Test keyboard navigation

## Testing

```bash
bun dev              # Start dev server
bun typecheck        # Type safety
bun lint             # Code quality
```

