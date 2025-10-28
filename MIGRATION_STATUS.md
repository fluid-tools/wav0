# SDK Architecture Migration Status

## ✅ Phase 1 Complete (Steps 1-9)

### New Packages Created

**@wav0/daw-sdk** - Framework-agnostic audio engine
- ✅ Pure TypeScript, zero React dependencies
- ✅ MediaBunny integration with iterator-based playback
- ✅ Event-driven architecture (EventTarget)
- ✅ Namespace-organized utils (time, volume, curves, automation)
- ✅ Zod schemas for runtime validation
- ✅ Builds successfully

**@wav0/daw-react** - React integration layer
- ✅ Jotai atoms with pluggable storage adapters
- ✅ `DAWProvider` for app-wide SDK access
- ✅ `useDAW()` hook for lifecycle management
- ✅ Storage adapters: browser (localStorage), memory
- ✅ Bug fixes: No module-time storage access, proper error handling
- ✅ Builds successfully

### Components Migrated (Partial)

✅ Updated to use new SDK utils:
- `components/daw/controls/clip-fade-handles.tsx`
- `components/daw/inspectors/clip-inspector-sheet.tsx`
- `components/daw/inspectors/clip-editor-drawer.tsx`
- `components/daw/inspectors/envelope-editor.tsx`

## 📋 Phase 2 Remaining (Step 10 - Full Migration)

### High-Priority Migrations

**State Atoms** (Currently in `/apps/web/lib/daw-sdk/state`):
- [ ] `clips.ts` - Clip mutation atoms (depends on playbackService)
- [ ] `tracks.ts` - Track mutation atoms (depends on playbackService, audioService)
- [ ] `ui.ts` - UI state and drag machine
- [ ] `timeline.ts` - Timeline section management
- [ ] `view.ts` - Viewport and derived metrics

**Hooks** (Currently in `/apps/web/lib/daw-sdk/hooks`):
- [ ] `use-clip-inspector.ts` - Complex hook with state mutations
- [ ] `use-drag-interaction.ts` - Drag state machine integration
- [ ] `use-live-automation-gain.ts` - Real-time automation control
- [ ] `use-playback-sync.ts` - Playback synchronization
- [ ] `use-timebase.ts` - Musical grid calculations

**Services** (Singleton pattern - needs elimination):
- [ ] `core/audio-service.ts` → Replace with `useDAWContext().getAudioEngine()`
- [ ] `core/playback-service.ts` → Replace with `useDAWContext().getTransport()`

### Components Needing Full Migration

32 remaining component files still import from `@/lib/daw-sdk`.

## Migration Strategy

### Immediate (Safe)
1. Import utils from new packages (time, volume, curves, automation)
2. Import types from new packages
3. Keep state/hooks in old location

### Future (Requires Refactor)
1. Rewrite state atoms to eliminate playbackService dependency
2. Create new hooks using Transport events
3. Migrate components one-by-one
4. Remove old SDK folder

## Usage Examples

### Current (Hybrid - RECOMMENDED)
```typescript
// Utils from new SDK
import { time, volume } from "@wav0/daw-sdk";

// State/hooks from old SDK (temp)
import { tracksAtom, useClipInspector } from "@/lib/daw-sdk";

const duration = time.formatDuration(1000);
const gain = volume.dbToGain(-6);
```

### Future (Full Migration)
```typescript
import { time, volume } from "@wav0/daw-sdk";
import { tracksAtom, useClipInspector } from "@wav0/daw-react";
import { useDAWContext } from "@wav0/daw-react";

function MyComponent() {
  const daw = useDAWContext();
  const transport = daw.getTransport();
  // ...
}
```

## Storage Adapter Ready

```typescript
// apps/web/app/layout.tsx
import { DAWProvider, browserAdapter } from "@wav0/daw-react";

<DAWProvider storageAdapter={browserAdapter}>
  {children}
</DAWProvider>
```

Switch to Convex/IndexedDB when ready:
```typescript
import { createConvexAdapter } from "@wav0/daw-react";
const adapter = createConvexAdapter(convexClient);
<DAWProvider storageAdapter={adapter}>
```

## Benefits Achieved

✅ Framework portability (SDK usable in Vue, Angular, vanilla JS)
✅ Clean separation (business logic vs UI state)
✅ Pluggable storage (localStorage → Convex → IndexedDB)
✅ MediaBunny alignment (event-driven, iterator-based)
✅ Type safety with strict mode
✅ Tree-shakeable exports
✅ Zero breaking changes to existing app

