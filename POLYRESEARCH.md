# Polyresearch: ms Performance Optimization

This repository is a polyresearch project. See PROGRAM.md for the research
program, PREPARE.md for contributor gate checks, and results.tsv for the
results ledger.

## Quick start for contributors

1. Read PROGRAM.md to understand the goal, metrics, editable surface, and hard
   reject criteria.
2. Read PREPARE.md for the gate check sequence you must pass before submitting.
3. Claim a thesis via a GitHub issue.
4. Work on a branch named `thesis-<issue-number>`.
5. Run all gates: `pnpm run build && pnpm run lint && pnpm run typecheck && pnpm run test && node bench/harness.mjs`
6. Submit a PR referencing your thesis issue.

## Harness

```bash
node bench/harness.mjs
```

Prints four tab-separated lines: `parse_ms`, `format_ms`, `parse_fp`, `format_fp`.
