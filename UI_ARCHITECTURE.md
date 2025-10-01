# WAV0 UI Architecture: Drawer vs Sheet

## Design Philosophy

Following **Logic Pro's dual-panel pattern**:
- **Focused editing** → Drawer (modal, centered)
- **Reference viewing** → Sheet (side panel, non-blocking)

---

## 🎯 When to Use Each

### Drawer (Modal Overlay)
**Purpose**: Focused, task-oriented editing

**Use cases**:
- ✅ Clip editing (envelope, fades, trim)
- ✅ Track settings (EQ, compression)
- ✅ Plugin parameters
- ✅ Any "edit one thing deeply" workflow

**Characteristics**:
- Centers attention
- Blocks timeline (intentional)
- Mobile-friendly (bottom drawer)
- Max-width on desktop (e.g., 4xl)
- Scrollable content area

**Example**: `ClipEditorDrawer`
```tsx
<Drawer>
  <DrawerContent className="max-h-[90vh]">
    <ScrollArea>
      {/* Envelope editor, fades, clip properties */}
    </ScrollArea>
  </DrawerContent>
</Drawer>
```

---

### Sheet (Side Panel)
**Purpose**: Reference, inspection, batch operations

**Use cases**:
- ✅ Event list (all clips, sortable)
- ✅ Mixer (all track levels)
- ✅ File browser
- ✅ Project metadata
- ✅ Any "see many things, quick navigation" workflow

**Characteristics**:
- Non-blocking (see timeline while open)
- Wide panels (720px–900px)
- Tabular/list data
- Search/filter UI
- Can stay open while working

**Example**: `EventListSheet`
```tsx
<Sheet>
  <SheetContent side="right" className="sm:w-[720px] lg:w-[900px]">
    {/* Filters, search, table of all events */}
  </SheetContent>
</Sheet>
```

---

## 📐 Layout Comparison

### Drawer Layout
```
┌────────────────────────────────────────┐
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ Edit Clip                     [×]│ │
│  │ Envelope, fades, clip props      │ │
│  │                                  │ │
│  │  [Scrollable content area]       │ │
│  │                                  │ │
│  │                            [Done]│ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
      Centered, max-width, overlay
```

### Sheet Layout
```
┌────────────────┬───────────────────────┐
│                │ Event List        [×] │
│                ├───────────────────────┤
│                │ [Search] [Filter]     │
│   Timeline     ├───────────────────────┤
│   Visible      │ Start  Track   Clip   │
│                │ 00:00  Track1  Kick   │
│                │ 00:01  Track2  Snare  │
│                │ ...                   │
│                │                       │
└────────────────┴───────────────────────┘
    Side panel, timeline still visible
```

---

## 🎨 Logic Pro Comparison

| Logic Pro         | WAV0 Equivalent    | Component Type |
|-------------------|--------------------|----------------|
| Piano Roll        | Clip Editor        | **Drawer**     |
| Audio Editor      | Clip Editor        | **Drawer**     |
| Event List        | Event List         | **Sheet**      |
| Mixer             | Track Mixer (todo) | **Sheet**      |
| Library           | File Browser       | **Sheet**      |
| Smart Controls    | Track Inspector    | **Drawer**     |

---

## 🔧 Implementation Details

### Current Architecture

```
components/daw/inspectors/
├── clip-editor-drawer.tsx    ← Focused editing (envelope, fades)
├── event-list-sheet.tsx       ← All events, sortable table
├── clip-inspector-sheet.tsx   ← DEPRECATED (kept for reference)
├── envelope-editor.tsx        ← Shared component
└── inspector-section.tsx      ← Shared layout helpers
```

### State Management

```typescript
// Drawer state (focused editing)
const clipInspectorOpenAtom = atom(false);
const clipInspectorTargetAtom = atom<{ trackId, clipId } | null>(null);

// Sheet state (list/reference)
const eventListOpenAtom = atom(false);
```

### Activation Pattern

**Drawer (Clip Editor)**:
- Right-click clip → "Edit..." → Opens drawer
- Double-click clip → Opens drawer
- Keyboard: `E` on selected clip

**Sheet (Event List)**:
- Toolbar button: "Events"
- Keyboard: `Cmd/Ctrl + E`
- Menu: View → Event List

---

## ✅ Benefits of This Architecture

1. **Clear mental model**: Edit = drawer, View = sheet
2. **Mobile-friendly**: Drawer naturally works on touch devices
3. **Non-blocking reference**: Sheet lets you work with timeline visible
4. **Professional UX**: Matches industry-standard DAW patterns
5. **Composable**: Can open sheet + drawer simultaneously if needed

---

## 🚀 Future Extensions

### Planned Drawers
- [ ] Track settings (EQ, compression, routing)
- [ ] Plugin editor (VST/AU parameters)
- [ ] MIDI editor (piano roll)
- [ ] Sample editor (waveform trimming)

### Planned Sheets
- [ ] Mixer (all track levels + panning)
- [ ] File browser (OPFS + project files)
- [ ] Tempo/signature editor
- [ ] Marker list
- [ ] Automation lanes overview

---

## 📚 Related Docs

- `ENVELOPE_DESIGN.md` - Volume automation architecture
- `components/daw/README.md` - Component organization
- `AGENTS.md` - UI/UX guidelines and standards

---

## Decision Log

**2025-10-01**: Refactored from single Sheet to Drawer + Sheet pattern
- **Reason**: Sheet was cramped for editing, didn't match DAW conventions
- **Outcome**: Cleaner UX, matches Logic Pro, better mobile support
- **Trade-off**: Slightly more complexity, but worth it for clarity

