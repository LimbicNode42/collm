import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Unit + evaluation tests — integration tests are excluded by default
    include: ['tests/unit/**/*.test.ts', 'tests/evaluation/**/*.eval.ts'],
    exclude: ['node_modules', 'dist', 'tests/integration/**'],
    typecheck: {
      tsconfig: './tests/tsconfig.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.ts',
        '**/*.d.ts',
        // llm.ts is the LLM provider integration layer — always mocked in unit
        // tests and exercised only by integration tests (which need real API keys).
        // Excluding it keeps coverage numbers meaningful.
        'src/services/llm.ts',
      ],
      // Fail CI if coverage drops below these thresholds.
      // Measured against the files listed above (llm.ts excluded).
      // Tighten progressively as the codebase grows.
      thresholds: {
        lines: 75,
        functions: 80,
        branches: 65,
        statements: 75,
      },
    },
    testTimeout: 30000, // 30 seconds for embedding model loading
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
