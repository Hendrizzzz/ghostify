# Contributing to Ghostify

Thanks for your interest in contributing. Here's how you can help.

## Reporting Bugs

Found something broken? Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser version and OS

## Suggesting Features

Have an idea? Open an issue and describe:
- The problem you're trying to solve
- How you envision the solution
- Why this would benefit other users

## Submitting Code

1. Fork the repo
2. Create a branch: `git checkout -b fix/your-fix` or `feature/your-feature`
3. Make source changes in `src/` when editing bundled scripts, then run `npm run build`
4. Edit `dist/` directly only for popup/static assets that do not have a source counterpart
5. Test on Instagram, Messenger, and Facebook pages affected by the change
6. Submit a PR with a clear description

## Finding New Patterns

When Instagram/Messenger updates break the extension:

1. Open DevTools Network with Preserve log enabled
2. Perform the action that should be blocked: read a message, type, or view a story
3. Filter for GraphQL, XHR/fetch, websocket, and beacon traffic
4. Find the smallest stable operation or payload token that identifies the privacy signal
5. Submit a PR updating `dist/config/patterns.json` and the relevant guard in `src/utils/network.js`

## Code Style

- No unnecessary comments
- Keep functions small and focused
- Test before submitting

## Questions?

Open an issue with the `question` label.
