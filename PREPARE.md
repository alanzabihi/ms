# PREPARE: Gate Checks for ms Optimization

Run all gates before submitting a candidate. Every gate must pass.

## Gates

### 1. Build

```bash
pnpm run build
```

Must exit 0. The harness imports from `dist/`, so build must precede benchmarking.

### 2. Lint

```bash
pnpm run lint
```

Must exit 0. Uses biome.

### 3. Typecheck

```bash
pnpm run typecheck
```

Must exit 0. Uses `tsc --noEmit` with strict settings including
`isolatedDeclarations` and `exactOptionalPropertyTypes`.

### 4. Tests (Node.js)

```bash
pnpm run test:nodejs
```

Must exit 0. 167 tests, 100% coverage threshold enforced. Runs jest with
`--env node`.

### 5. Tests (Edge)

```bash
pnpm run test:edge
```

Must exit 0. Same 167 tests under `@edge-runtime/jest-environment`.

### 6. Correctness fingerprints

```bash
node bench/harness.mjs
```

Output must contain:
```
parse_fp	parse:3de2a72832c8310a
format_fp	format:3557e89b64e4b470
```

Any deviation means the optimization changed observable behavior.

### 7. Format guard

From the same harness run, `format_ms` must not exceed **110%** of the
baseline format_ms (~30 ms). I.e., format_ms < 33 ms on the baseline
machine. (On other machines, compare to that machine's own baseline.)

### 8. File scope

```bash
git diff --name-only main
```

Must show only `src/index.ts` (plus any polyresearch protocol files).
No other source files may be modified.

## Quick-run all gates

```bash
pnpm run build && pnpm run lint && pnpm run typecheck && pnpm run test:nodejs && pnpm run test:edge && node bench/harness.mjs
```
