# Claude Code instructions for ms polyresearch

## Project context

This is a polyresearch performance optimization project on vercel/ms.
The goal is to make `parse()` faster. See PROGRAM.md for full details.

## Key commands

- `pnpm run build` — build with tsdown to dist/
- `pnpm run lint` — biome lint
- `pnpm run typecheck` — tsc --noEmit (strict)
- `pnpm run test` — jest (Node + Edge, 167 tests, 100% coverage)
- `pnpm run attw` — type resolution check
- `node bench/harness.mjs` — benchmark (requires build first)

## Editable surface

Only `src/index.ts` may be modified (specifically the `parse()` function and
any module-level constants it needs). All other files are frozen.

## Hard constraints

- Fingerprints must match: `parse:3de2a72832c8310a`, `format:3557e89b64e4b470`
- format_ms must not regress >10% from baseline (~28ms)
- All gates in PREPARE.md must pass
- No new dependencies, no API changes, no type changes
- **Do NOT commit `results.tsv` on your thesis branch.** That file is maintained
  by the lead on `main` via `polyresearch sync` and listed in the CANNOT-modify
  set in PROGRAM.md. If you run `polyresearch sync` locally by accident, reset
  the file before committing: `git checkout main -- results.tsv` (from your
  worktree, pointing at the latest main).
