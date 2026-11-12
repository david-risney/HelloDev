import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // Playwright expects chromium, but we need persistent context for extensions.
    // Tests use the custom fixture in fixtures.js instead of the default browser.
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        browserName: 'chromium'
      }
    }
  ]
});
