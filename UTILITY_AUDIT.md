# Utility Audit Report

## Old SDK Utils vs New SDK Utils

### Time Utils Comparison

#### In New SDK (`packages/daw-sdk/src/utils/time.ts`) ✅
Exported in `time` namespace:
1. `formatDuration()` ✅
2. `secondsToMs()` ✅
3. `msToSeconds()` ✅
4. `msToPixels()` ✅
5. `pixelsToMs()` ✅
6. `msToBeats()` ✅
7. `beatsToMs()` ✅
8. `msToBarsBeats()` ✅
9. `barsBeatsToMs()` ✅
10. `snapTimeMs()` ✅
11. `formatBarsBeatsTicks()` ✅
12. `getDivisionBeats()` ✅
13. `generateBarsGrid()` ✅
14. `computeSubdivisionMs()` ✅

#### In Old SDK (`apps/web/lib/daw-sdk/utils/time-utils.ts`) 
Additional functions:
1. `snapToGrid()` - Old version, `snapTimeMs()` is the new version ✅
2. `calculateBeatMarkers()` - NOT USED in any components ❌
3. `calculateTimeMarkers()` - NOT USED in any components ❌
4. `enumerateGrid()` - NOT USED in any components ❌

#### In Old SDK (`apps/web/lib/daw-sdk/utils/time-grid.ts`)
Actually used functions:
1. `chooseTimeSteps()` - Used by view.ts
2. `formatTimeMs()` - Used by view.ts
3. `generateTimeGrid()` - Used by view.ts atom

**Conclusion**: `time-grid.ts` functions are actually used, not the deprecated ones

### Other Utils Status

#### Volume Utils
- Old: `/apps/web/lib/daw-sdk/utils/volume-utils.ts`
- New: `/packages/daw-sdk/src/utils/volume.ts` ✅
- Status: FULLY MIGRATED

#### Curve Utils
- Old: `/apps/web/lib/daw-sdk/utils/curve-functions.ts`
- New: `/packages/daw-sdk/src/utils/curves.ts` ✅
- Status: FULLY MIGRATED

#### Automation Utils
- Old: `/apps/web/lib/daw-sdk/utils/automation-utils.ts`
- New: `/packages/daw-sdk/src/utils/automation.ts` ✅
- Status: FULLY MIGRATED

#### Audio Buffer Utils
- Old: `/apps/web/lib/daw-sdk/utils/audio-buffer.ts`
- New: `/packages/daw-sdk/src/utils/audio-buffer.ts` ✅
- Status: FULLY MIGRATED

---

## Missing from New SDK

### Critical: time-grid.ts Functions
**Need to add to SDK:**
- `chooseTimeSteps(pxPerMs)`
- `formatTimeMs(ms, format)`
- `generateTimeGrid(params)`

**Used by:**
- `/apps/web/lib/daw-sdk/state/view.ts` - cachedTimeGridAtom

**Action Required**: Add these to `packages/daw-sdk/src/utils/time.ts` namespace

---

## Import Usage Analysis

### Components Using Old Imports (28 files)
**Breakdown:**
- Atoms only: 23 files (safe to keep for now)
- Services: 4 files (need bridge replacement)
- Hooks: 1 file (README reference only)
- Utils: 0 files directly (all via hooks/atoms)

### Hooks in Old SDK (6 files)
1. `use-clip-inspector.ts` - Used in 3 components
2. `use-daw-initialization.ts` - Used in providers.tsx (will delete)
3. `use-drag-interaction.ts` - Used in multiple components
4. `use-live-automation-gain.ts` - Used in automation components
5. `use-playback-sync.ts` - Used internally by other hooks
6. `use-timebase.ts` - Used in 2 components

---

## Migration Priority

### Must Do Before Deletion
1. ✅ Add `time-grid` functions to SDK
2. → Keep hooks in old location (still needed)
3. → Atoms stay in old location (event sync handles it)

### Can Delete Safely
1. ✅ Old duplicate utils (volume, curves, automation, audio-buffer)
2. → Old time-utils AFTER adding time-grid to SDK
3. → Old core services AFTER verifying bridges

### Keep For Now
1. State atoms (`/state/*`) - Event sync keeps them functional
2. Hooks (`/hooks/*`) - Components still use them
3. Service instances - Bridges need them

---

## Action Plan

### Step 1: Add time-grid to SDK ⏭️
Add to `packages/daw-sdk/src/utils/time.ts`:
```typescript
export function chooseTimeSteps(pxPerMs: number): TimeSteps { ... }
export function formatTimeMs(ms: number, format: "ss.ms" | "mm:ss"): string { ... }
export function generateTimeGrid(params: {...}): TimeGrid { ... }
```

### Step 2: Update view.ts import ⏭️
```typescript
// Before
import { generateTimeGrid } from '../utils/time-grid';

// After
import { time } from '@wav0/daw-sdk';
const grid = time.generateTimeGrid(...);
```

### Step 3: Delete old utils ⏭️
```bash
rm -rf apps/web/lib/daw-sdk/utils/
```

### Step 4: Verify build ⏭️
```bash
bun run build
```

---

## Findings Summary

**Good News:**
- Most utils already migrated ✅
- Only time-grid functions missing
- No breaking changes needed
- Event sync working perfectly

**Action Required:**
- Add 3 functions to SDK (15-30 min)
- Update 1 import in view.ts
- Delete old utils folder
- Test build

**Can Postpone:**
- Hook migrations (still functional)
- Atom migrations (event sync handles it)
- Service deletion (bridges depend on them)


