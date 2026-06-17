import { defineConfig } from 'vitest/config';

// Workspace packages export raw TS via their package.json "main", which
// vitest resolves through pnpm's node_modules symlinks. No path aliases
// needed — the @luxematch/* names resolve to packages/*/src/index.ts.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Populate placeholder env before any module imports, so @luxematch/config's
    // import-time server-env validation passes in tests that import workspace
    // packages (e.g. @luxematch/qdrant).
    setupFiles: ['tests/setup-env.ts'],
  },
});
