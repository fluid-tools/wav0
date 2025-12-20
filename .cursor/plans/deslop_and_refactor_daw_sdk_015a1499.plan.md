---
name: Deslop and Refactor DAW SDK
overview: Refactor the monolithic Transport, optimize audio processing performance, and remove AI-generated slop from the DAW SDK core.
todos:
  - id: deslop-core-files
    content: Remove injected rules and fluff comments in core files
    status: pending
  - id: fix-types-mediabunny
    content: Replace 'any' types in core types with proper MediaBunny imports
    status: pending
  - id: optimize-audio-engine-buffers
    content: Refactor AudioEngine.concatenateBuffers for performance
    status: pending
  - id: extract-signal-chain
    content: Extract SignalChain manager from Transport.ts
    status: pending
  - id: extract-scheduler
    content: Extract Scheduler logic from Transport.ts
    status: pending
  - id: optimize-sync-logic
    content: Optimize track synchronization and automation diffing
    status: pending
---

