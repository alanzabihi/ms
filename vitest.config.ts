import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      clean: true,
      exclude: [
        'lint-staged.config.ts',
        'tsdown.config.ts',
        'vitest.config.ts',
      ],
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
