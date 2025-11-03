# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WAV0 is an open-source AI-native music studio built with Next.js and React. It's a browser-based DAW (Digital Audio Workstation) with AI-powered audio generation, multi-track editing, and real-time collaboration features.

**Key Features:**
- Browser-based DAW with MediaBunny audio engine
- AI agent for natural language audio generation
- Multi-track editing with automation
- Convex backend for real-time state sync
- Monorepo structure with Turborepo

## Development Commands

### Root Commands
```bash
# Install dependencies
bun install

# Development (all apps)
bun dev

# Development (specific apps)
bun dev:web       # Web app only
bun dev:server    # Convex backend only
bun dev:setup     # Convex setup

# Build
bun build         # Build all packages
bun check-types   # TypeScript check across all packages

# Code Quality
bun check         # Biome check + auto-fix
bun format        # Biome format
bun lint          # Biome lint
```

### Web App Commands (apps/web)
```bash
cd apps/web

# Development
bun dev           # Next.js dev with Turbopack

# Build & Deploy
bun build         # TypeScript check + Next.js build
bun start         # Production server
bun deploy:convex+build  # Deploy Convex + build web app

# Code Quality
bun check-types   # TypeScript check
bun lint          # Biome lint
bun format        # Biome format
```

### Convex Backend (packages/server)
```bash
cd packages/server

# Development
bun dev           # Convex dev mode
bun dev:setup     # Convex setup wizard

# Deploy
bun deploy        # Deploy Convex + trigger web build
```

### DAW SDK (packages/daw-sdk)
```bash
cd packages/daw-sdk

bun build         # Compile TypeScript
bun dev           # Watch mode
bun test          # Run Vitest tests
```

## Architecture

### Monorepo Structure

```
wav0/
├── apps/
│   └── web/              # Next.js web app
│       ├── app/          # App router pages
│       ├── components/   # React components
│       └── lib/          # Shared utilities
│           ├── daw-sdk/  # DAW core engine
│           ├── state/    # Jotai state management
│           └── utils/    # Utilities
├── packages/
│   ├── daw-sdk/          # DAW SDK (being migrated)
│   ├── daw-react/        # React bindings for DAW
│   └── server/           # Convex backend
└── tooling/              # Shared tooling (empty)
```

### Core Technologies

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **State Management**: Jotai (atoms), XState (state machines)
- **Audio Engine**: MediaBunny (Web Audio API wrapper)
- **Backend**: Convex (real-time database + functions)
- **Auth**: Better Auth with Convex adapter
- **Styling**: Tailwind CSS 4, Radix UI primitives
- **Build**: Turborepo, Turbopack, Bun
- **Code Quality**: Biome (formatter + linter)

### DAW Architecture

**Audio Playback Chain:**
```
AudioSource → ClipGain → EnvelopeGain → MuteSoloGain → MasterGain → Output
```

**Key Services:**
- `PlaybackService` (`apps/web/lib/daw-sdk/core/playback-service.ts`): Core playback engine
  - Singleton pattern for global playback state
  - Per-clip iterator-based scheduling using MediaBunny
  - Dual gain chain for envelope automation + mute/solo
  - Time-accurate scheduling with AudioContext
  - See `audio-scheduling-constants.ts` for timing precision constants

- `AudioService` (`apps/web/lib/daw-sdk/core/audio-service.ts`): Audio file management
  - Loading audio files via MediaBunny
  - Waveform generation
  - Audio metadata extraction

- `RenderService` (`apps/web/lib/daw-sdk/core/render-service.ts`): Audio rendering/export
  - Multi-track mixdown
  - Export to WAV/MP3

**State Management:**
- Track state: Jotai atoms in `apps/web/lib/state/`
- Playback state: XState machines for transport control
- UI state: Jotai atoms + React Context

**Bridge Pattern (Migration in Progress):**
The codebase is migrating from singleton services to SDK-based architecture. See `BRIDGE_USAGE_GUIDE.md` for patterns on using legacy services during migration.

### Convex Backend

Located in `packages/server/convex/`:
- Real-time database with file-based routing
- Auth integration with Better Auth
- API structure: `api.moduleName.functionName`

**Important Convex Patterns:**
- Always use new function syntax with explicit `args` and `returns` validators
- Use `v.null()` for functions that return nothing
- Index names should include all fields: `by_field1_and_field2`
- Use `internalQuery`/`internalMutation`/`internalAction` for private functions
- Never use `filter()` in queries - use indexes with `withIndex()` instead

See `.cursor/rules/convex_rules.mdc` for comprehensive Convex guidelines.

## Code Style & Patterns

### Import Order
1. React
2. Next.js
3. Third-party libraries
4. Local modules (absolute imports with `@/`)
5. Types (separate with `import type`)

### Component Patterns
```typescript
// Use arrow functions
const Component = () => {}

// Define props with type keyword
type ComponentProps = {
  value: string
}

// Use cn() for className merging
import { cn } from "@/lib/utils"
className={cn("base-class", conditionalClass && "active")}

// Use cva for variants
import { cva } from "class-variance-authority"
const variants = cva("base", {
  variants: { size: { sm: "...", lg: "..." } }
})
```

### Naming Conventions
- Components: PascalCase
- Props types: Descriptive + "Props" suffix
- Files: kebab-case for non-components
- Variants: descriptive names ending in "Variants"

### Formatting (Biome Config)
- 2-space indentation
- No semicolons
- Single quotes
- Trailing commas

### Audio Scheduling Constants

When working with Web Audio API scheduling, use constants from `audio-scheduling-constants.ts`:
- `AUTOMATION_CANCEL_LOOKAHEAD_SEC` (0.01s): Lookback window for canceling automation
- `AUTOMATION_SCHEDULING_EPSILON_SEC` (0.001s): Minimum gap between automation segments
- `MIN_AUTOMATION_SEGMENT_DURATION_SEC` (0.001s): Minimum valid automation duration
- `MAX_AUTOMATION_CURVE_DURATION_SEC` (30s): Upper bound for automation curves

These prevent Web Audio API errors from overlapping `setValueCurveAtTime` calls.

## Web Interface Guidelines

Based on Vercel's design guidelines (https://vercel.com/design/guidelines):

**Interactions:**
- Full keyboard support per WAI-ARIA APG patterns
- Hit targets ≥24px (mobile ≥44px)
- Mobile input font-size ≥16px to prevent zoom
- Keep submit enabled until request starts
- URL reflects state (use nuqs for deep-linking)
- Links are `<a>`/`<Link>` elements (support Cmd/Ctrl-click)
- Optimistic UI with error rollback
- Confirm destructive actions

**Accessibility:**
- Prefer native semantics before ARIA
- Icon-only buttons need `aria-label`
- Redundant status cues (not color-only)
- Meet APCA contrast standards
- Honor `prefers-reduced-motion`

**Performance:**
- Virtualize large lists (use `virtua`)
- Track re-renders with React DevTools
- Batch layout reads/writes
- Mutations target <500ms
- Preload above-fold images only

See `AGENTS.md` lines 50-166 for complete web interface guidelines.

## MediaBunny Integration

The DAW uses MediaBunny for audio processing. Key resources:

**Documentation:**
- Entry point: https://mediabunny.dev/llms.txt
- TypeScript definitions: https://mediabunny.dev/mediabunny.d.ts
- Guide: https://mediabunny.dev/guide/introduction
- Examples: https://mediabunny.dev/examples
- Architecture reference: https://context7.com/vanilagy/mediabunny/llms.txt

**Usage Patterns:**
- Audio loading via `mediabunny.loadAudio()`
- Iterator-based playback for multi-clip tracks
- Integration with Web Audio API for effects chain

## Environment Variables

Required for development:
- `CONVEX_DEPLOYMENT`: Convex deployment URL
- `NEXT_PUBLIC_CONVEX_URL`: Public Convex URL
- `BETTER_AUTH_SECRET`: Auth secret
- `ELEVENLABS_API_KEY`: AI audio generation
- `AWS_*`: S3 storage credentials
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage

See `.env.example` for full list.

## Testing & Quality

- TypeScript strict mode enabled
- Biome for linting/formatting (no ESLint/Prettier)
- Type checking: `bun check-types` (runs across all packages)
- Test framework: Vitest (in daw-sdk package)

## Common Patterns

### State Updates with Side Effects
When updating track state that affects audio playback:
1. Update Jotai atoms
2. Call corresponding PlaybackService methods
3. Use bridge pattern during migration (see `BRIDGE_USAGE_GUIDE.md`)

### Audio File Loading
```typescript
import { audioService } from "@/lib/daw-sdk/core/audio-service"

const audioData = await audioService.loadAudioFile(file, trackId)
```

### Playback Control
```typescript
import { playbackService } from "@/lib/daw-sdk/core/playback-service"

await playbackService.play(tracks, startTimeMs)
await playbackService.stop()
await playbackService.updateTrackVolume(trackId, volume)
```

### Convex Queries/Mutations
```typescript
import { api } from "@wav0/server/convex/_generated/api"
import { useQuery, useMutation } from "convex/react"

const data = useQuery(api.moduleName.queryName, { arg: value })
const mutate = useMutation(api.moduleName.mutationName)
```

## AI Development Context

When implementing features:
- MediaBunny handles low-level audio processing
- PlaybackService manages multi-track playback and scheduling
- Jotai atoms for UI state, XState for complex workflows
- Convex for persistence and real-time sync
- Always maintain the gain chain architecture
- Use audio scheduling constants for timing precision
- Follow bridge patterns during SDK migration

## Migration Status

**In Progress:**
- Migrating from singleton services to SDK-based architecture
- Bridge pattern connecting old and new code (see `BRIDGE_USAGE_GUIDE.md`)
- DAW React bindings in `packages/daw-react/`
- Do not remove bridges without confirming all references are migrated

## Git Workflow

- Main branch: `main`
- Current branch: `preview/beta`
- Use conventional commits
- Run `bun check` before committing
