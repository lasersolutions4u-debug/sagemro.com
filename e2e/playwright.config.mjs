import { defineConfig, devices } from '@playwright/test';

import { e2eRuntime, localRunPaths, installLocalDnsMapping } from './support/runtime.mjs';
import path from 'node:path';

const runtime = e2eRuntime();
const { runDir } = localRunPaths();
installLocalDnsMapping();

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.mjs/,
  outputDir: path.join(runDir, 'results'),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: path.join(runDir, 'report') }]]
    : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 15_000,
    channel: process.platform === 'win32' ? 'chrome' : 'chromium',
    launchOptions: {
      args: ['--no-proxy-server', '--host-resolver-rules=MAP *.127.0.0.1.nip.io 127.0.0.1',
        `--unsafely-treat-insecure-origin-as-secure=${[runtime.apiBase, runtime.customerBase, runtime.engineerBase, runtime.adminBase].join(',')}`],
    },
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      command: 'node scripts/run-local-e2e.mjs server worker',
      url: `${runtime.apiBase}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'node scripts/run-local-e2e.mjs server frontend',
      url: runtime.customerBase,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'node scripts/run-local-e2e.mjs server admin',
      url: runtime.adminBase,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
