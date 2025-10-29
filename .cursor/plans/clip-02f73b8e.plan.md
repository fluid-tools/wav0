<!-- 02f73b8e-0a29-4305-a4b9-1279cc5bd86f d547779d-b221-4c6f-af2d-331c7e6e74da -->
# Fix Automation & Playback Issues

## Issues Identified

### Bug 1: Track-level automation transfer bug

**Location**: `apps/web/lib/daw-sdk/utils/automation-migration-helpers.ts:105`
**Problem**: Line 105 filters `if (point.clipId && point.clipId !== clipId) return false;` which allows `undefined` clipIds to pass through, incorrectly transferring track-level automation points in clip-attached mode.
**Fix**: Change to `if (point.clipId !== clipId) return false;` so only points with matching clipId are transferred.

### Bug 2: Overlapping setValueCurveAtTime

**Location**: `apps/web/lib/daw-sdk/core/playback-service.ts:414`
**Problem**: Sequential segments can overlap when rescheduling automation, causing `NotSupportedError: setValueCurveAtTime overlaps`. Need to ensure segments don't overlap by validating `acStart` times against previous segment ends.
**Fix**: Track the end time of the last scheduled segment and ensure new segments start after the previous one ends (with a small epsilon buffer).

### Bug 3: Visual playback accuracy

**Location**: `apps/web/lib/daw-sdk/core/playback-service.ts:842-846`
**Problem**: `START_GRACE_SEC` window zeroes `leadSec`, allowing audio to start before the playhead visually reaches the clip. The playhead updates via `requestAnimationFrame` but audio scheduling happens immediately.
**Fix**: Instead of zeroing `leadSec` in the grace window, clamp it to a minimum positive value (e.g., 0.005s) to ensure audio starts slightly after the playhead passes the clip boundary. Also verify playhead update timing aligns with audio scheduling.

## Implementation Steps

### Step 1: Fix clip-attached filter logic and validate same-track moves

- File: `apps/web/lib/daw-sdk/utils/automation-migration-helpers.ts`
- Change line 105 from `if (point.clipId && point.clipId !== clipId) return false;` to `if (point.clipId !== clipId) return false;`
- File: `apps/web/lib/daw-sdk/state/clips.ts`
- Confirm same-track moves only shift clip-bound automation (range points stay put)
- Update unit coverage around both helpers to prevent regressions

### Step 2: Prevent setValueCurveAtTime overlaps

- File: `apps/web/lib/daw-sdk/core/playback-service.ts`
- Track `lastScheduledEnd` (AudioContext time) after each `setValueCurveAtTime`
- If `acStart < lastScheduledEnd`, bump start to `lastScheduledEnd + epsilon` (e.g., 0.001s)
- Initialize `lastScheduledEnd = now` once anchor gain is set

### Step 3: Align audio scheduling with playhead visuals

- File: `apps/web/lib/daw-sdk/core/playback-service.ts`
- Replace `if (Math.abs(leadSec) < START_GRACE_SEC) leadSec = 0;` with logic that preserves positive lead while clamping negatives (e.g., `leadSec = Math.max(leadSec, MIN_POSITIVE_LEAD)`)
- Instrument lead vs. visual playhead delta (dev-mode logging or `lastScheduleLeadMs`) to verify across zoom levels
- Double-check `getPlaybackTime()` and frame update cadence so UI stays in sync

### Step 4: Update automated coverage

- File: `apps/web/lib/daw-sdk/utils/__tests__/automation-transfer.test.ts`
- Ensure clip-attached tests exclude undefined clipIds for cross-track moves
- Reintroduce regression tests around same-track moves to guarantee range automation stays put
- If practical, add a smoke test exercising automation scheduling overlap logic

### Step 5: Migration status assessment

- Review current usage of legacy vs `daw-sdk`/`daw-react` modules
- Summarize outstanding migration gaps (plan doc or inline comment) so future tasks are scoped

## Files to Modify

1. `apps/web/lib/daw-sdk/utils/automation-migration-helpers.ts` - Fix filter logic
2. `apps/web/lib/daw-sdk/core/playback-service.ts` - Fix overlaps and visual accuracy
3. `apps/web/lib/daw-sdk/utils/__tests__/automation-transfer.test.ts` - Update tests

## Verification

- Run `bun test apps/web/lib/daw-sdk/utils/__tests__/automation-transfer.test.ts`
- Manual QA: Move clip with track-level automation, verify it stays on source track
- Manual QA: Play project with automation segments, verify no console errors
- Manual QA: Play from various positions and zoom levels, verify audio starts when playhead visually reaches clip