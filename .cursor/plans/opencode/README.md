# WAV0 Architecture Plans

> **Last Updated**: 2025-01-20
> **Status**: Active Development

This directory contains comprehensive architecture plans for the WAV0 DAW project.

---

## Project Overview

WAV0 is a browser-based Digital Audio Workstation (DAW) built with:
- **Next.js 15** + **React 19** - Frontend framework
- **Jotai** - State management
- **Web Audio API** - Audio engine
- **Web MIDI API** - MIDI input
- **Convex** - Backend/database

---

## Plan Index

### Core Audio Engine

| Plan | Status | Description |
|------|--------|-------------|
| [Sampler Engine](./sampler_engine.plan.md) | 📋 Planning | Sample playback with pitch/time control |
| [Voice Management](./voice_management.plan.md) | 📋 Planning | Polyphony and voice stealing algorithms |
| [Bus Architecture](./bus_architecture.plan.md) | 📋 Planning | Track → Bus → Master routing |

### MIDI System

| Plan | Status | Description |
|------|--------|-------------|
| [MIDI Integration](../midi_integration.plan.md) | ✅ Phase 1-2 Done | MIDI types, service, quantization |

### Other Plans (Legacy)

| Plan | Status | Description |
|------|--------|-------------|
| [State Management Refactor](../state_management_refactor.plan.md) | 📋 Planning | Jotai architecture |
| [DAW SDK Refactor](../daw_sdk_refactor_analysis_51bf1b2b.plan.md) | 📋 Analysis | SDK cleanup |

---

## Implementation Order

### Phase A: Foundation (Current)
```
✅ 1. MIDI Types (types/midi.ts)
✅ 2. MIDI Service (core/midi-service.ts)
✅ 3. Quantization (utils/quantization.ts)
✅ 4. MIDI Time (utils/midi-time.ts)
```

### Phase B: Core Engine (Next)
```
⏳ 5. MIDI Player (core/midi-player.ts)
⏳ 6. Sampler Types (types/sampler.ts)
⏳ 7. Sampler Engine (core/sampler-engine.ts)
⏳ 8. Recording Service (core/recording-service.ts)
```

### Phase C: Integration
```
📋 9. MIDI Learn (core/midi-learn.ts)
📋 10. Bus Types (types/bus.ts)
📋 11. Bus Class (core/bus.ts)
📋 12. React Atoms (atoms/midi.ts, atoms/sampler.ts)
📋 13. React Hooks (hooks/use-midi.ts, hooks/use-sampler.ts)
```

### Phase D: UI & Routes
```
📋 14. /sampler Route
📋 15. Virtual Keyboard Component
📋 16. Pad Grid Component
📋 17. Piano Roll Editor
📋 18. DAW Track Integration
```

---

## Key Design Decisions

### Sampler Engine

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pad count | Configurable, default 16 | MPC-style, expandable |
| Pitch control | playbackRate + granular | Native + quality option |
| Time stretch | Granular synthesis | Duration-preserving |
| Max polyphony | 32 voices | Desktop-focused |
| Default polyphony | 4 voices | Conservative start |
| Voice stealing | Release → Oldest → Quietest | Musical priority |

### Bus Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Routing model | Logic Pro style | Familiar workflow |
| Track output | Configurable bus | Flexible grouping |
| Send system | Pre/post fader | Industry standard |
| Master bus | Singleton with limiter | Safety + metering |

### MIDI System

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API | Direct Web MIDI | Zero dependencies |
| Timebase | 960 PPQ | High precision |
| Safari | On-screen keyboard | No Web MIDI support |
| Learn | CC → any param | Logic Pro style |

---

## File Structure

```
packages/daw-sdk/src/
├── types/
│   ├── midi.ts           ✅ DONE
│   ├── sampler.ts        📋 TODO
│   ├── bus.ts            📋 TODO
│   └── index.ts          ✅ Updated
├── core/
│   ├── midi-service.ts   ✅ DONE
│   ├── midi-player.ts    📋 TODO
│   ├── midi-learn.ts     📋 TODO
│   ├── sampler-engine.ts 📋 TODO
│   ├── recording-service.ts 📋 TODO
│   ├── bus.ts            📋 TODO
│   └── master-bus.ts     📋 TODO
└── utils/
    ├── quantization.ts   ✅ DONE
    ├── midi-time.ts      ✅ DONE
    ├── granular.ts       📋 TODO (v2)
    └── index.ts          ✅ Updated

packages/daw-react/src/
├── atoms/
│   ├── midi.ts           📋 TODO
│   └── sampler.ts        📋 TODO
└── hooks/
    ├── use-midi.ts       📋 TODO
    └── use-sampler.ts    📋 TODO

apps/web/
├── app/
│   └── sampler/
│       └── page.tsx      📋 TODO
└── components/
    └── sampler/
        ├── pad-grid.tsx  📋 TODO
        ├── virtual-keyboard.tsx 📋 TODO
        └── ...
```

---

## Commands

```bash
# Development
bun dev              # Start dev server

# Type checking
bun check-types      # TypeScript check all packages

# Linting
bun lint             # Run Biome linter
bun lint:fix         # Auto-fix issues

# Build
bunx turbo build     # Build all packages
```

---

## Contributing

When adding new features:

1. **Create a plan first** - Add to this directory with `.plan.md` suffix
2. **Update this README** - Add to the plan index
3. **Follow the phase order** - Build on completed foundations
4. **Run type checks** - `bun check-types` must pass
5. **Document decisions** - Update design decisions table

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| ⏳ | In Progress |
| 📋 | Planned |
| ❌ | Blocked |
| 🔄 | Needs Revision |
