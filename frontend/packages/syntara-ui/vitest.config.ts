import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const isShardedCoverage = process.env.CI === 'true' && Boolean(process.env.VITEST_COVERAGE_DIR)
const mutationTimeoutValue = process.env.SYNTARA_MUTATION_VITEST_TIMEOUT_MS
const mutationTimeoutMs = mutationTimeoutValue === undefined ? undefined : Number(mutationTimeoutValue)

if (mutationTimeoutMs !== undefined && (!Number.isSafeInteger(mutationTimeoutMs) || mutationTimeoutMs < 1)) {
  throw new Error('SYNTARA_MUTATION_VITEST_TIMEOUT_MS must be a positive integer when set')
}

const mutationTimeoutOverrides =
  mutationTimeoutMs === undefined ? {} : { testTimeout: mutationTimeoutMs, hookTimeout: mutationTimeoutMs }

// https://vitest.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  test: {
    ...mutationTimeoutOverrides,
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    css: true,
    mockReset: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/playwright.config.ts',
      '**/*.browser.test.{ts,tsx}',
      '**/.tmp-xfail-int-*/**',
      '**/.stryker-tmp/**',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: process.env.VITEST_COVERAGE_DIR ?? 'coverage',
      reporter: isShardedCoverage ? ['json'] : ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
        'e2e/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.stories.*',
        '**/tanstackRouteTree.tsx',
      ],
    },
  },
})
