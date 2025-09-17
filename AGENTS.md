# AGENTS.md - WAV0 AI Development Guide

## Build/Lint/Test Commands
```bash
# Development
bun dev              # Start dev server with Turbopack
bun build            # TypeScript check + build with Turbopack
bun start            # Start production server

# Code Quality
bun typecheck        # TypeScript type checking
bun lint             # Run Biome linter
bun lint:fix         # Auto-fix linting issues
bun format           # Format code with Biome
```

## Code Style Guidelines

### Imports
- Use absolute imports with `@/` alias
- Separate type imports: `import type { Props } from '...'`
- Import order: React → Next.js → third-party → local → types

### Component Structure
- Use arrow functions: `const Component = () => {}`
- Export components as named exports
- Define props with `type` keyword: `type ComponentProps = {...}`
- Use `cn()` utility for className merging
- Apply variants with `class-variance-authority` (cva)

### Naming Conventions
- Components: PascalCase (`Message`, `CodeBlock`)
- Props types: Descriptive + "Props" suffix (`MessageProps`)
- Variants: descriptive names (`messageContentVariants`)
- Files: kebab-case for non-components

### Error Handling
- Use TypeScript strict mode
- Handle async operations with proper error boundaries
- Validate props with TypeScript interfaces

### Formatting
- 2-space tabs (Biome configured)
- No semicolons (Biome removes them)
- Single quotes for strings
- Trailing commas in objects/arrays