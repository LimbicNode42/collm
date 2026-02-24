import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for integration tests only.
 *
 * Used by `npm run test:integration`. These tests hit the real LLM API
 * so they are excluded from the default config and run separately in CI
 * only when API keys are present.
 *
 * No coverage — integration tests measure correctness, not code coverage.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    exclude: ['node_modules', 'dist'],
    typecheck: {
      tsconfig: './tests/tsconfig.json',
    },
    testTimeout: 120000, // 2 minutes — LLM calls can be slow
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
