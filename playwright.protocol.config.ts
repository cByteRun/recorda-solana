import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './protocol-ui-tests', outputDir: './test-results/protocol', workers: 1, retries: 0, timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/protocol', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4445', timezoneId: 'UTC', trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4445', url: 'http://127.0.0.1:4445', reuseExistingServer: !process.env.CI,
    env: { RECORDA_VITE_CACHE_DIR: 'node_modules/.vite-protocol', VITE_SOLANA_RPC_URL: process.env.RECORDA_TEST_RPC || 'http://127.0.0.1:8899' } }
});
