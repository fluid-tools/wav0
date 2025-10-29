<!-- 02f73b8e-0a29-4305-a4b9-1279cc5bd86f db111659-426a-44bd-b370-1a6f9220406b -->
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

### Step 1: Fix clip-attached filter logic

- File: `apps/web/lib/daw-sdk/utils/automation-migration-helpers.ts`
- Change line 105 from `if (point.clipId && point.clipId !== clipId) return false;` to `if (point.clipId !== clipId) return false;`
- Update tests if needed to verify track-level points are excluded in clip-attached mode

### Step 2: Prevent setValueCurveAtTime overlaps

- File: `apps/web/lib/daw-sdk/core/playback-service.ts`
- In `rescheduleTrackAutomation`, track `lastScheduledEnd` (AudioContext time) after each `setValueCurveAtTime` call
- Before scheduling a new segment, check if `acStart < lastScheduledEnd`:
- If so, skip or adjust `acStart` to `lastScheduledEnd + epsilon` (e.g., 0.001s)
- Initialize `lastScheduledEnd = now` after anchor point is set

### Step 3: Improve visual playback accuracy

- File: `apps/web/lib/daw-sdk/core/playback-service.ts`
- In `runClipAudioIterator`, refine the grace window logic so audio never fires before the playhead crosses the clip boundary:
- Replace `if (Math.abs(leadSec) < START_GRACE_SEC) leadSec = 0;` with a guard that clamps small positive leads to `START_GRACE_SEC` but leaves negative leads untouched, e.g. `if (leadSec >= 0 && leadSec < START_GRACE_SEC) leadSec = START_GRACE_SEC;`
- Verify `getPlaybackTime()` accuracy (interaction between `startTime` and `playbackTimeAtStart`) and confirm transport time pushes to UI on the same animation frame
- If residual drift remains, record the delta and expose a small configurable visual offset for UI reconciliation

### Step 4: Update tests

- File: `apps/web/lib/daw-sdk/utils/__tests__/automation-transfer.test.ts`
- Verify "ignores unattached points when transferring clip-bound automation" test excludes undefined clipIds
- Add test case for overlapping automation segments if possible

### Step 5: Migration status assessment

- Check usage of legacy vs new SDK components
- Document current migration state in comments or migration notes

## Files to Modify

1. `apps/web/lib/daw-sdk/utils/automation-migration-helpers.ts` - Fix filter logic
2. `apps/web/lib/daw-sdk/core/playback-service.ts` - Fix overlaps and visual accuracy
3. `apps/web/lib/daw-sdk/utils/__tests__/automation-transfer.test.ts` - Update tests

## Verification

- Run `bun test apps/web/lib/daw-sdk/utils/__tests__/automation-transfer.test.ts`
- Manual QA: Move clip with track-level automation, verify it stays on source track
- Manual QA: Play project with automation segments, verify no console errors
- Manual QA: Play from various positions and zoom levels, verify audio starts when playhead visually reaches clip

### To-dos

- [ ] Refine computeAutomationTransfer for clip-only moves and clip-relative remap
- [ ] Adjust drop handlers to remove shiftTrackAutomationInRange and use ms clamps
- [ ] Update automation-transfer tests for new semantics
- [ ] Instrument playback scheduling and UI playhead to locate early-start bug
- [ ] Implement timing correction once measurements confirm root cause
- [ ] Run bun typecheck/lint/build and manual DAW QA