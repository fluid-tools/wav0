# Contributing to WAV0

Thank you for your interest in contributing to WAV0! We're building the future of AI-native music production, and your contributions help make audio creation accessible to everyone.

## 🎯 Our Mission

WAV0 is designed to make music production as fast and accessible as possible. Think of us as the "Figma for audio" - we want to reduce the steps from idea to sound while maintaining professional quality. Our goal is to make anyone capable of creating music, regardless of their technical background.

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- Git
- A modern web browser

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/wav0.git
   cd wav0
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys and configuration
   ```

4. **Start the development server**
   ```bash
   bun dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` to see WAV0 running locally.

## 🏗️ Project Structure

```
wav0/
├── app/                    # Next.js App Router pages
│   ├── (marketing)/       # Marketing pages
│   ├── (protected)/       # Protected app pages
│   └── api/               # API routes
├── components/            # React components
│   ├── daw/              # DAW-specific components
│   ├── ai-elements/      # AI chat interface components
│   └── ui/               # Reusable UI components
├── lib/                  # Core libraries and utilities
│   ├── audio/            # Audio processing and playback
│   ├── state/            # State management (Jotai)
│   └── utils/            # Utility functions
├── db/                   # Database schema and migrations
└── public/               # Static assets
```

## 🎵 Core Components

### WAV0 AI Agent
- **Location**: `app/(protected)/create/`
- **Purpose**: AI-powered music generation and editing
- **Key Features**: Natural language to audio, soundpack generation

### Studio/DAW
- **Location**: `app/(protected)/daw/` and `components/daw/`
- **Purpose**: In-browser digital audio workstation
- **Key Features**: Multi-track editing, automation, real-time playback

### Playground
- **Location**: `app/(protected)/create/`
- **Purpose**: Quick experimentation with AI generation
- **Key Features**: Rapid prototyping, asset generation

### Vault
- **Location**: `app/(protected)/vault/`
- **Purpose**: Secure storage and version control for audio files
- **Key Features**: Private storage, sharing controls, version history

## 🛠️ Development Guidelines

### Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check for issues
bun lint

# Auto-fix issues
bun lint:fix

# Format code
bun format
```

### TypeScript

- Use strict TypeScript
- Prefer `type` over `interface` for component props
- Use absolute imports with `@/` alias
- Separate type imports: `import type { Props } from '...'`

### React Patterns

- Use functional components with arrow functions
- Prefer Server Components over Client Components when possible
- Use `useCallback` and `useMemo` for performance optimization
- Follow the component structure: exported component, subcomponents, helpers, types

### Audio Development

- **Audio Engine**: Built on [MediaBunny](https://mediabunny.dev) for browser-based processing
- **State Management**: Jotai for global state, React Query for server state
- **Real-time Processing**: Web Audio API with optimized performance

## 🧪 Testing

```bash
# Run type checking
bun typecheck

# Run linting
bun lint

# Build the project
bun build
```

### Testing GitHub Workflows Locally

We use [act](https://github.com/nektos/act) to test GitHub Actions workflows locally before pushing. This saves time and prevents broken CI runs.

#### Prerequisites

1. **Install Docker** (required for act to run)
   - [Docker Desktop](https://www.docker.com/products/docker-desktop) for macOS/Windows
   - Docker Engine for Linux

2. **Install act**
   ```bash
   # macOS (Homebrew)
   brew install act

   # Windows (Chocolatey)
   choco install act-cli

   # Linux
   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
   ```

#### Running Workflows Locally

**Test CI workflow (lint, typecheck, build):**
```bash
# Run the full CI workflow
act -W .github/workflows/ci.yml

# Run with specific GitHub image (more accurate)
act -W .github/workflows/ci.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest

# Pass secrets for Turbo remote caching (optional)
act -W .github/workflows/ci.yml \
  -s TURBO_TOKEN=your_token \
  -s TURBO_TEAM=your_team
```

**Test Convex deploy workflow (production):**
```bash
# ⚠️ WARNING: This will actually deploy to Convex if you provide real keys
act push -W .github/workflows/deploy-convex.yml \
  -P ubuntu-latest=catthehacker/ubuntu:act-latest \
  -s CONVEX_DEPLOY_KEY=your_deploy_key \
  -s CONVEX_DEPLOYMENT=your_deployment_id

# Use --dryrun to test without executing
act push -W .github/workflows/deploy-convex.yml --dryrun
```

**Test Convex preview deploy:**
```bash
# Test preview deploy (requires ENABLE_CONVEX_PREVIEWS=1)
act pull_request -W .github/workflows/deploy-convex.yml \
  -P ubuntu-latest=catthehacker/ubuntu:act-latest \
  -s CONVEX_DEPLOY_KEY=your_preview_key \
  -s CONVEX_DEPLOYMENT=your_preview_deployment \
  --var ENABLE_CONVEX_PREVIEWS=1
```

#### Common act Options

- `-W <workflow.yml>` - Specify which workflow to run
- `-P ubuntu-latest=<image>` - Override runner image
- `-s KEY=value` - Pass secrets
- `--var KEY=value` - Pass repository variables
- `-n` or `--dryrun` - Show what would run without executing
- `-l` - List available workflows and jobs
- `--job <job_name>` - Run a specific job only
- `-v` - Verbose output for debugging

#### Best Practices

1. **Always use --dryrun first** for deploy workflows to avoid accidental deployments
2. **Use catthehacker/ubuntu images** for better compatibility with GitHub Actions
3. **Test with real secrets in a safe environment** (e.g., preview/staging)
4. **Check Docker resources** - act can be resource-intensive; ensure Docker has enough RAM/CPU

#### Troubleshooting

**act fails to start:**
- Ensure Docker is running (`docker ps`)
- Try pulling the runner image manually: `docker pull catthehacker/ubuntu:act-latest`

**Workflow differences from GitHub:**
- Some GitHub Actions features aren't fully supported by act
- Environment contexts may differ slightly
- Use GitHub's runner images for maximum accuracy

**Secrets not working:**
- Use `-s` flag, not `--secret` (older syntax)
- Check secret names match workflow exactly (case-sensitive)
- Use `--secret-file .secrets` for multiple secrets:
  ```bash
  # .secrets file format:
  CONVEX_DEPLOY_KEY=xxx
  TURBO_TOKEN=yyy
  ```

## 📝 Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Write clean, readable code
- Add comments for complex logic
- Update documentation if needed
- Test your changes thoroughly

### 3. Commit Your Changes

We use conventional commits:

```bash
git commit -m "feat: add new audio effect to DAW"
git commit -m "fix: resolve playback issue in Safari"
git commit -m "docs: update API documentation"
```

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a pull request with:
- Clear description of changes
- Screenshots/videos if UI changes
- Link to related issues
- Test results

## 🎨 Design Guidelines

### UI/UX Principles

- **Accessibility First**: Follow WCAG guidelines, ensure keyboard navigation
- **Mobile Responsive**: Design for mobile-first, then enhance for desktop
- **Performance**: Optimize for speed and smooth interactions
- **Consistency**: Use our design system and component library

### Audio UX

- **Immediate Feedback**: Audio changes should be instant
- **Visual Clarity**: Clear visual representation of audio data
- **Error Prevention**: Prevent destructive actions, provide undo options
- **Workflow Efficiency**: Minimize clicks and steps to common tasks

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear Description**: What happened vs. what you expected
2. **Steps to Reproduce**: Detailed steps to recreate the issue
3. **Environment**: Browser, OS, WAV0 version
4. **Screenshots/Recordings**: Visual evidence of the issue
5. **Console Logs**: Any error messages or warnings

## ✨ Feature Requests

When suggesting features:

1. **Problem Statement**: What problem does this solve?
2. **Proposed Solution**: How should it work?
3. **Use Cases**: Specific scenarios where this would be helpful
4. **Priority**: How important is this to your workflow?

## 🎵 Audio-Specific Contributions

### Audio Processing
- Focus on browser compatibility
- Optimize for real-time performance
- Consider memory usage for large audio files
- Test across different audio formats

### DAW Features
- Maintain professional DAW standards
- Ensure precise timing and synchronization
- Support common keyboard shortcuts
- Provide visual feedback for all interactions

### AI Integration
- Make AI features intuitive and fast
- Provide clear feedback on generation progress
- Allow easy iteration and refinement
- Support export to common formats

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [MediaBunny Guide](https://mediabunny.dev/guide/introduction)
- [Jotai Documentation](https://jotai.org/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Biome Documentation](https://biomejs.dev/)

## 💬 Community

- **Discord**: [Join our community](https://discord.gg/wav0)
- **Twitter**: [@wav0ai](https://twitter.com/wav0ai)
- **Documentation**: [wav0.app/docs](https://wav0.app/docs)

## 📄 License

By contributing to WAV0, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in our:
- README.md contributors section
- Release notes
- Community highlights

Thank you for helping make audio creation accessible to everyone! 🎵
