import { defineConfig } from 'vitest/config';

// Workspace packages export raw TS via their package.json "main", which
// vitest resolves through pnpm's node_modules symlinks. No path aliases
// needed — the @luxematch/* names resolve to packages/*/src/index.ts.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
