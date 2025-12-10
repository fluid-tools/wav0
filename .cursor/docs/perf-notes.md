# DAW Perf Notes (Hooks & Compiler)

Principles
- Prefer pure derivation over hooks: sort/filter/map in helpers; let React Compiler memoize.
- `useEffect` only for subscriptions to external sources (transport events, DOM listeners) or imperative interop; keep effects minimal and idempotent.
- `useEffectEvent` for handlers that need fresh props/state without recreating subscriptions (interval callbacks, transport listeners, DOM handlers).
- Use `useMemo`/`useCallback` only when a stable reference is required by a memoized child or third-party API; avoid for local computations.
- Never write refs during render; move to effects or effect events.
- Avoid prop-to-state mirrors; derive from inputs each render.

DAW-specific
- Transport/automation overlays: subscribe once, update DOM/actors directly; avoid per-tick React state.
- Timeline/playhead: imperative DOM updates for 60fps; React state only for sync points.
- Automation lanes: compute points via pure helpers (no inline `useMemo`).
- Shortcuts/time reads: use `useEffectEvent` to read transport time in listeners without re-subscribing.
- Export previews: render via pure helpers; no memo hooks needed.


