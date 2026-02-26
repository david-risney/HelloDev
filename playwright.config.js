import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
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
