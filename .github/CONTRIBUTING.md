# Contributing to Razzia

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Razzia.git`
3. Install dependencies: `npm install` (in both root and client folders if applicable)
4. Checkout the `dev` branch: `git checkout dev`
5. Create a branch from `dev`: `git checkout -b feat/your-feature-name`

## Branch Naming

- `feat/` — new feature
- `fix/` — bug fix
- `chore/` — maintenance, dependencies
- `docs/` — documentation only

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add timer display to question screen
fix: prevent crash when quiz has no questions
chore: update dependencies
```

## Pull Requests

- **Target the `dev` branch**, not `main`. PRs targeting `main` directly will not be merged except for critical security hotfixes.
- If you already have a local clone, make sure to pull the latest changes from `dev` before starting: `git checkout dev && git pull`
- **One PR = one feature or fix.** Do not bundle multiple features in a single PR — it becomes unmanageable to review and harder to revert if something breaks.
- Make sure the CI passes before requesting review
- Link any related issue with `Closes #123`

## Code Style

- Run `npm run lint` and fix any errors before committing
- Keep components small and focused
- No commented-out code

## Reporting Issues

Use the issue templates provided in this repository.
