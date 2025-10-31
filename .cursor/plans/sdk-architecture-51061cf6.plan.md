<!-- 51061cf6-085b-46d1-89a7-efd1a26ee87d 8c1e0345-e335-4b67-9137-8afa6b9f6353 -->
# Fix clip automation movement + finish migration (incremental, safe)

## Scope

- Fix clip automation unpredictability (clip-attached semantics, unit mixups, dedupe)
- Remove same-track automation shifting (only move clip)
- Resolve duplicate key in `automation-lane.tsx`
- Verify curve-preview + playback bridge
- Progress migration without breaking build

## Targeted edits

- apps/web/components/daw/panels/daw-track-content.tsx
- Use ms for project end: replace `projectEndPosition` with `totalDurationAtom` value
- Normalize commit time: keep `dropStartMs` from preview (no px)
- Same-track: remove `shiftTrackAutomationInRange` (clip points are clip-relative)
- Cross-track: keep `computeAutomationTransfer` result but pass ms-only and clip mode
- apps/web/lib/daw-sdk/utils/automation-migration-helpers.ts
- In `computeAutomationTransfer`: for `mode==='clip-attached'` do NOT offset `time`; treat `time` as clip-relative; set `clipId` to target; preserve order; only offset in `time-range` mode
- Add `dedupeSegments(segments, keptPointIds)` by `(from,to)` pair
- apps/web/components/daw/panels/automation-lane.tsx
- Prevent duplicate key warnings: dedupe `sorted` by `id` (fallback: key=`${point.id}-${point.time}`)
- Render uses absolute time: ensure `resolveClipRelativePoint` uses `clipRelativeTime ?? time` for clip points
- apps/web/components/daw/controls/curve-preview.tsx
- Convert 0–1 `safeShape` -> -99..+99 via `safeShape * 198 - 99`
- packages/daw-react/src/bridges/playback-bridge.ts
- Already fixed `getMasterMeterDb()` -> `getMasterDb()`; verify

## Tests

- Unit: `automation-transfer.test.ts`
- clip-attached: move across tracks, times preserved (no delta)
- same-track move: envelope unchanged; clip start moves
- time-range mode: offset applied; boundaries respected
- dedupe: no duplicate segments or points by id/time within epsilon

## Migration safety

- Keep atoms in `apps/web/lib/daw-sdk` for now; add explicit re-exports so `daw-container.tsx` finds `addTrackAtom`
- Replace remaining direct playback calls with bridge where available; otherwise keep legacy for now
- After stabilization, move atoms to `@wav0/daw-react` with corrected imports, then delete legacy dirs

## Rollout

1) Land helpers + daw-track-content fixes
2) Fix automation-lane keys/dedupe
3) Curve-preview verify; run tests; typecheck; build
4) Replace direct service calls gradually; prune legacy utils/hooks
5) Atom migration (final), then remove legacy

### To-dos

- [ ] Use totalDurationAtom (ms) for project end; stop using px
- [ ] Remove shiftTrackAutomationInRange; only move clip on same track
- [ ] computeAutomationTransfer: no time offset for clip-attached mode
- [ ] Add dedupeSegments to avoid duplicate (from,to) pairs
- [ ] Dedupe points by id/time or use composite keys; fix data reads
- [ ] Map 0–1 safeShape to -99..+99 in curve-preview.tsx
- [ ] Expand tests: clip-attached, same-track, time-range, dedupe
- [ ] Ensure addTrackAtom is re-exported from lib index
- [ ] Replace synchronize/reschedule/direct calls with bridge mutations where possible
- [ ] Delete legacy utils/hooks after checks
- [ ] Move atoms to @wav0/daw-react with correct imports and store
- [ ] Profile drag/resize after fixes; verify no regressions