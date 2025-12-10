---
name: Playback Slowdown Investigation
overview: Identify and mitigate playback/timeline slowdown by inspecting render triggers, heavy effects, and animation patterns; apply targeted fixes without unnecessary memoization (React Compiler on).
todos:
  - id: verify-compiler
    content: Confirm React Compiler enabled; note manual memo/useCallback usage
    status: pending
  - id: react19-levers
    content: Map React 19.2 perf levers (Activity, hydration order, ref prop) to timeline
    status: pending
    dependencies:
      - verify-compiler
  - id: memo-audit
    content: Audit/remove manual memo/useCallback; keep only identity-critical cases
    status: pending
    dependencies:
      - verify-compiler
  - id: profile-timeline
    content: Identify timeline UI render hotspots and heavy effects during playback
    status: pending
    dependencies:
      - verify-compiler
      - react19-levers
      - memo-audit
  - id: inspect-playback
    content: Review daw-sdk playback/transport effects and event batching
    status: pending
    dependencies:
      - verify-compiler
      - memo-audit
  - id: apply-fixes
    content: Optimize state/handlers, animations (transform-tier), Activity boundaries, UI virtualization, and compositional structure for playback
    status: pending
    dependencies:
      - profile-timeline
      - inspect-playback
  - id: validate
    content: Re-run React Scan, lint/check types, sanity playback
    status: pending
    dependencies:
      - apply-fixes
---

# Playback slowdown plan

1) Baseline & constraints

- Verify React Compiler enabled in Next/Turbopack config; remove redundant memo/useCallback (keep only identity-critical for non-React consumers or third-party hooks).
- Capture current playback/timeline repro notes (route + interaction) and React Scan snapshot we have.
- Map React 19.2 levers: Activity boundaries for hydration ordering, Server Functions/Form Actions for client load shedding, ref-as-prop (forwardRef deprecates), and hydration-focused splitting.

2) Identify hotspots

- Inspect timeline grid/track row/clip components under `apps/web` (timeline UI) for render counts vs prop/state/context changes; check event handlers (scroll/drag/zoom) and derived calculations done in render.
- Review playback pipeline in `apps/web/lib/daw-sdk/core` (e.g., `playback-service`, transport hooks, atoms/selectors) for heavy work in effects/layout effects during playback.
- Check animation code (timeline grid, playhead, selections) for layout-triggering styles (width/left/top) or costly filters/shadows; look for non-virtualized lists and DOM churn.
- Audit manual memo/callback usage around timeline/playback; plan removals with compiler on.

3) Fixes (targeted, minimal risk)

- Stabilize inputs: move derived data to selectors/memoized helpers; avoid recreating handler objects per frame; normalize timeline state to reduce context churn.
- UI render trimming: apply virtualization/windowing to tracks/clips if missing; batch pointer/scroll events (rAF/throttle); remove redundant manual memoization where compiler handles it; keep stable identities only when crossing out of React.
- Animation perf: switch timeline movements to transform/opacity (compositor tier); add `will-change` only for hot paths; drop expensive filters/blurs; cap layer sizes on repeating marquees/tickers (per Motion perf tiers).
- React 19.2 hydration: introduce Activity boundaries to hydrate transport controls first, then timeline canvas/panels; split heavy client islands; adopt Server Functions/Form Actions where client mutations are heavy.
- Audio path: ensure playback callbacks are debounced to UI, move heavy work off main thread where possible; guard useEffect/useLayoutEffect dependency arrays to avoid excessive runs; consider deferred updates (`useDeferredValue`/`useTransition`) for non-critical UI.
- Composability: refactor `/daw` UI to choose composed subtrees at parent level (timeline/transport/panels variants) instead of prop-driven branches; keep conditionals local to small components for intrinsic UI state only.

4) Validation

- Re-run React Scan on playback interaction; compare render counts and “other” time; adjust based on formatted data.
- Run `bun check-types`/`bun lint` if code changes; quick manual timeline playback sanity check.