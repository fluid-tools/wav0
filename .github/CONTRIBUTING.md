# Contributing to WAV0

Thank you for your interest in contributing to WAV0! We're building the future of AI-native audio production and sound design, and your contributions help make high-quality production accessible to everyone.

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- Git
- A modern web browser

## 💡 Tips for New Contributors

- **Ask questions on [Discord](https://wav0.app/discord)** - Don't hesitate to reach out! The community is friendly and helpful.
- **Explore the codebase** - Use your IDE's search to find related code, check existing patterns, and understand the architecture before making changes.
- **Start small** - Fix typos, improve documentation, or tackle "good first issue" labels to get familiar with the codebase.
- **Read the docs** - Check [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md) for detailed development guidelines and patterns.

## 🛠️ Development Guidelines

See [AGENTS.md](../AGENTS.md) for development guidelines and the `.cursor/rules` folder for more detailed guidelines.

### Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting:

```bash
bun lint        # Check for issues
bun lint:fix    # Auto-fix issues
bun format      # Format code
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

## 🤖 AI Development Guidelines

AI use is **accepted and encouraged** for productivity, but **no slop allowed**. Quality over speed.

### Recommended Tools & Workflow

**Cursor (Recommended)**
- Use **Plan Mode** first to understand the approach
- Then use **Build Mode** to implement
- Ask questions and understand changes before committing
- Leverage features like **Agent Review** and **Bugbot** for code quality checks

**Code Review Tools**
- Use tools like **CodeRabbit** and similar AI code review assistants
- Don't blindly accept suggestions—review and understand them

### Quality Checklist

Before submitting PRs:
- ✅ Run `bun lint` and fix all issues
- ✅ Run `bun check-types` to ensure no TypeScript errors
- ✅ Run `bun build` to verify the project builds successfully
- ✅ Run `bun test` if tests exist
- ✅ Review your diff for AI-generated slop

### Removing AI Slop

We have a **deslop command** in `.cursor/commands/` to help clean up AI-generated code issues:

- Extra comments that a human wouldn't add or are inconsistent with the codebase
- Unnecessary defensive checks or try/catch blocks in trusted codepaths
- Type casts to `any` to bypass type issues
- Any style inconsistencies with the rest of the file

**Always review AI-generated code**—understand what it does, ensure it matches our patterns, and remove slop before committing.

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

### Audio-Specific Considerations

- Focus on browser compatibility
- Optimize for real-time performance
- Consider memory usage for large audio files
- Test across different audio formats
- Maintain professional DAW standards
- Ensure precise timing and synchronization
- Support common keyboard shortcuts
- Provide visual feedback for all interactions

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

## 🧪 Testing GitHub Workflows Locally

We use [act](https://github.com/nektos/act) to test GitHub Actions workflows locally. Install Docker and act, then:

```bash
# Test CI workflow
act -W .github/workflows/ci.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest

# Test deploy workflow (use --dryrun first!)
act push -W .github/workflows/deploy-convex.yml --dryrun
```

See [act documentation](https://github.com/nektos/act) for full usage.

## 💬 Community

- **Discord**: [Join our community](https://wav0.app/discord)
- **Twitter**: [@wav0ai](https://twitter.com/wav0ai)

## 📄 License

By contributing to WAV0, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in our:
- README.md contributors section
- Release notes
- Community highlights

Thank you for helping make audio creation accessible to everyone! 🎵
