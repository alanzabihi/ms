# PROGRAM: Make `ms` Measurably Faster

- **Lead GitHub login:** alanzabihi
- **Fork:** alanzabihi/ms
- **Upstream:** vercel/ms (v4.0.0, ESM-only, Node >= 20)

## Goal

Reduce the execution time of `ms` library operations, measured in milliseconds
and percent, while preserving every observable behavior.

## Metrics

| Metric | Workload | Role | Baseline | Reported as |
|--------|----------|------|----------|-------------|
| **parse_ms** | 2M calls to `parse()` over 30 diverse inputs (short units, long units, decimals, negatives, bare numbers) | **Primary — optimize** | ~155 ms | ms and % change |
| **format_ms** | 2M calls to `format()` (alternating short/long) over 18 diverse inputs | **Guard — must not regress** | ~30 ms | ms and % change |

### Why parse is primary

`parse()` at ~77 ns/call is 5× slower than `format()` at ~15 ns/call. The
bottleneck is a single complex regex with named capture groups that runs on every
call. Format is already a chain of comparisons and `Math.round` — little room to
improve. Optimizing parse yields the most absolute gain; format is the guard
because regressions there would be gratuitous since it shares no code path with
parse.

### Guard tolerance

format_ms must not regress by more than **10%** from the candidate's own
baseline run. (The format path is not being touched, so any regression would
indicate accidental damage.)

## Correctness invariants

- **Fingerprints**: `parse_fp` and `format_fp` from the harness must match
  baseline values exactly:
  - `parse_fp=parse:3de2a72832c8310a`
  - `format_fp=format:3557e89b64e4b470`
- Fingerprints are SHA-256 digests of all distinct output values. Any
  behavioral divergence (different NaN, different rounding, different string)
  will change the fingerprint and fail the candidate.

## Editable surface

Only `src/index.ts` may be modified. Everything else — tests, config, CI,
types, build — is off-limits.

## Hard rejects

A candidate is rejected if **any** of:

1. `parse_fp` or `format_fp` changes
2. `format_ms` regresses > 10%
3. `pnpm run lint` fails
4. `pnpm run typecheck` fails
5. `pnpm run build` fails
6. `pnpm run test:nodejs` fails
7. `pnpm run test:edge` fails
8. Public API or exported types change (checked by tests + typecheck)
9. New runtime dependencies are added
10. Files outside `src/index.ts` are modified

## Experiment ideas (starting points for contributors)

These are suggestions — contributors should pursue whatever approach they
believe will move the metric, as long as invariants hold.

1. **Replace regex with hand-rolled parser**: The current `parse()` uses a
   single complex regex with named groups and case-insensitive flag. A
   character-by-character parser using charCode comparisons could eliminate
   regex compilation and matching overhead entirely.

2. **Avoid parseFloat for integer inputs**: Most real-world inputs like `"1h"`,
   `"30s"`, `"7d"` are integers. A fast integer-parsing path that falls back
   to `parseFloat` only for decimal inputs could eliminate overhead for the
   common case.

3. **Optimize unit lookup with charCode dispatch**: The current switch statement
   has 30+ cases checked sequentially after `.toLowerCase()`. A lookup table
   keyed on first character (or first + last character) could resolve units in
   O(1) instead of falling through a long switch.

4. **Eliminate `.toLowerCase()` allocation**: Instead of calling `.toLowerCase()`
   on the unit string (which allocates a new string), compare characters with
   OR-masking (`c | 0x20`) to handle case-insensitivity without allocation.

5. **Cache or pre-compile the regex**: If regex must stay, removing named groups
   and the `i` flag (handling case manually) may reduce regex engine overhead.

## Harness

`bench/harness.mjs` — runs with plain `node`, no dependencies. Prints:

```
parse_ms	<float>
format_ms	<float>
parse_fp	parse:<hex>
format_fp	format:<hex>
```
