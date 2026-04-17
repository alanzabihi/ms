# PROGRAM: Make `ms` Measurably Faster

This is the research playbook for the ms performance-optimization project.
It tells agents what to optimize, what they can touch, and what constraints
to respect. Read this before every experiment.

required_confirmations: 0
metric_tolerance: 3
metric_direction: lower_is_better
lead_github_login: alanzabihi
auto_approve: true
assignment_timeout: 24h
review_timeout: 12h
min_queue_depth: 5
max_queue_depth: 10

## Goal

Reduce the execution time of `ms` library operations, measured in milliseconds
and percent, while preserving every observable behavior.

## Metrics

- **Primary — parse_ms**: 2M calls to `parse()` over 30 diverse inputs
  (short units, long units, decimals, negatives, bare numbers).
  Baseline ~155 ms. **Optimize this.**
- **Guard — format_ms**: 2M calls to `format()` alternating short/long over
  18 diverse inputs. Baseline ~30 ms. **Must not regress by more than 10%.**

An improvement must reduce parse_ms by at least **3 ms**. format_ms may not
regress by more than **3 ms** compared to its baseline.

Secondary constraint: correctness. The harness's `parse_fp` must equal
`parse:3de2a72832c8310a` and `format_fp` must equal
`format:3557e89b64e4b470`. All 167 existing tests must pass on both Node and
Edge runtime environments.

### Why parse is primary

`parse()` at ~77 ns/call is 5× slower than `format()` at ~15 ns/call. The
bottleneck is a single complex regex with named capture groups that runs on
every call. Format is already a chain of comparisons and `Math.round` — little
room to improve. Optimizing parse yields the most absolute gain; format is the
guard because regressions there would be gratuitous since it shares no code
path with parse.

## What you CAN modify

- `src/index.ts` — the library source, including `parse`, `parseStrict`,
  `format`, `ms`, and the module-level constants and helper functions
  (`fmtShort`, `fmtLong`, `plural`). Types and exported signatures must not
  change.

## What you CANNOT modify

- `.polyresearch/` — the reproducible environment (if/when present)
- `POLYRESEARCH.md` — the coordination protocol
- `PROGRAM.md` — this research playbook
- `PREPARE.md` — the evaluation setup
- `results.tsv` — maintained by the lead on `main`
- `bench/` — the benchmark harness
- `src/*.test.ts` — the test suite
- `node_modules/` — dependencies
- `package.json` — dependency manifest and scripts
- `tsconfig.json`, `biome.json`, `jest.config.ts`, `tsdown.config.ts` — build
  and tooling config
- `.github/` — CI and GitHub config
- `README.md`, `LICENSE`, `assets/`

## Constraints

- **Public API and exported types are frozen.** The exports `ms`, `parse`,
  `parseStrict`, `format`, and `StringValue` must keep their current
  signatures and runtime behavior for all inputs covered by the tests and the
  harness fingerprint set.
- **No new dependencies** (neither runtime nor dev).
- **Runtime targets unchanged** — must keep working on Node >= 20 and under
  `@edge-runtime/jest-environment`.
- **Fingerprint equality is exact.** Any change that affects `parse_fp` or
  `format_fp` is a hard reject, even if the test suite still passes.
- **format is a guard**, not a target. It may regress by up to 10% on its own
  baseline, but a regression that does not correspond to a parse_ms win is
  almost always a sign of accidental damage and will be rejected.

## Hard rejects

A candidate is rejected if **any** of:

1. `parse_fp` or `format_fp` changes.
2. `format_ms` regresses more than 10% (or more than 3 ms absolute).
3. `pnpm run lint` fails.
4. `pnpm run typecheck` fails.
5. `pnpm run build` fails.
6. `pnpm run test:nodejs` fails.
7. `pnpm run test:edge` fails.
8. Public API or exported types change.
9. New runtime dependencies are added.
10. Any file outside the **CAN modify** list is touched.

## Experiment ideas (starting points for contributors)

These are suggestions — pursue whatever approach moves the metric, as long as
invariants hold.

1. **Hand-rolled parser replacing regex**: eliminate the regex engine from
   the hot path; use charCode comparisons and bit-masking for case folding.
2. **Fast integer fast path**: most inputs are integers like `"1h"`, `"30s"`,
   `"7d"`. Accumulate digits with `c - 48` and fall back to `parseFloat` only
   when a `.` is seen.
3. **CharCode unit dispatch**: replace the 30-case switch with a dispatch on
   first character plus length, avoiding `.toLowerCase()` altogether.
4. **Simplified regex**: drop named capture groups and the `i` flag; normalize
   case with one `.toLowerCase()` call on the whole string before matching.
5. **Combined fast path**: single-pass parser doing sign, number, unit, and
   dispatch without any intermediate allocation.

## Harness

`bench/harness.mjs` — runs with plain `node`, no dependencies. Prints four
tab-separated lines:

```
parse_ms	<float>
format_ms	<float>
parse_fp	parse:<hex>
format_fp	format:<hex>
```
