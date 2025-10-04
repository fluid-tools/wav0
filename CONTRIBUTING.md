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
