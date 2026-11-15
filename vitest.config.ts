import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/web/server/**/*.test.ts',
      'apps/mobile/src/session-persistence.test.ts',
    ],
    testTimeout: 10000,
  },
});
