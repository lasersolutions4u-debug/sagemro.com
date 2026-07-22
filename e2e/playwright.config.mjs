import { defineConfig, devices } from '@playwright/test';

import { e2eRuntime } from './support/runtime.mjs';

const runtime = e2eRuntime();

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.mjs/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx wrangler dev --local --persist-to ../e2e/.state --env-file ../e2e/.generated/worker.env --ip 127.0.0.1 --port 8878 --log-level warn --show-interactive-dev-session false',
      cwd: '../worker',
      url: `${runtime.apiBase}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `VITE_API_BASE=${runtime.apiBase} npm run dev -- --host 0.0.0.0 --port 4273`,
      cwd: '../frontend',
      url: runtime.customerBase,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `VITE_API_BASE=${runtime.apiBase} npm run dev -- --host 0.0.0.0 --port 4274`,
      cwd: '../admin',
      url: runtime.adminBase,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
