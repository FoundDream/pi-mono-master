# Contributing to pi-mono-master

Thanks for your interest in contributing! Here's how you can help.

## Getting Started

```bash
git clone https://github.com/FoundDream/pi-mono-master.git
cd pi-mono-master
bun install
cp .env.example .env
```

## Development

```bash
# Run a specific chapter
bun run ch01

# Start docs dev server
bun run docs:dev

# Build docs
bun run docs:build
```

## How to Contribute

### Reporting Bugs

- Use the [Bug Report](https://github.com/FoundDream/pi-mono-master/issues/new?template=bug_report.md) template
- Include your environment info and steps to reproduce

### Suggesting Features

- Use the [Feature Request](https://github.com/FoundDream/pi-mono-master/issues/new?template=feature_request.md) template

### Submitting Changes

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test that all chapters still run correctly
5. Submit a pull request

### Documentation

- Documentation lives in the `docs/` directory
- Both English (`docs/en/`) and Chinese (`docs/zh/`) versions should be updated
- Run `bun run docs:dev` to preview changes locally

## Code Style

- TypeScript with strict mode
- Use Bun as the runtime
- Keep chapters self-contained and progressively building on each other

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
