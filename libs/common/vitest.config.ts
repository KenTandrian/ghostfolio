import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  resolve: {
    tsconfigPaths: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/common',
      provider: 'v8'
    }
  }
});
