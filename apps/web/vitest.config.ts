import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Default environment for .ts files (API routes, pure logic).
    // Component tests (.tsx) declare // @vitest-environment jsdom per file.
    environment: 'node',
    // jest-dom matchers + any global setup — loaded in all environments
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Only measure coverage for the files we actually test
      include: [
        'app/api/messages/route.ts',
        'app/api/nodes/route.ts',
        'app/api/nodes/[id]/route.ts',
        'lib/api-proxy.ts',
        'app/login/page.tsx',
        'app/register/page.tsx',
      ],
      exclude: [
        'node_modules/',
        'tests/',
        '.next/',
        '**/*.config.{ts,mjs}',
        '**/*.d.ts',
      ],
      thresholds: {
        // Slightly lower than backend services — React branches are harder to
        // instrument precisely and some proxy paths require full Next.js runtime
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
