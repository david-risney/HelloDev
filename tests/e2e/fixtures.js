// Playwright fixtures for testing the HelloDev Chrome extension.
// Launches a persistent browser context with the extension loaded.

import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '../../src');

/**
 * Find a Chromium-based browser executable.
 * Prefers Edge Dev > Edge Stable > Playwright's bundled Chromium.
 */
function findBrowserExecutable() {
  const candidates = [
    // Edge Dev
    process.env.EDGE_DEV_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge Dev\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge Dev', 'Application', 'msedge.exe'),
    // Edge Stable
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    // Linux/macOS Edge
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-dev',
    // Linux Chromium/Chrome fallbacks
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];

  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return undefined; // Fall back to Playwright's bundled Chromium
}

/**
 * Custom fixture that provides:
 * - context: a persistent BrowserContext with the extension loaded
 * - extensionId: the extension's ID (derived from service worker URL)
 */
export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const executablePath = findBrowserExecutable();
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions require headed mode
      ...(executablePath ? { executablePath } : {}),
      channel: executablePath ? undefined : 'msedge',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--disable-default-apps'
      ]
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Wait for the service worker to register so we can extract the extension ID
    let swURL;
    const existingWorkers = context.serviceWorkers();
    if (existingWorkers.length > 0) {
      swURL = existingWorkers[0].url();
    } else {
      const sw = await context.waitForEvent('serviceworker');
      swURL = sw.url();
    }

    // URL format: chrome-extension://<id>/background.js
    const match = swURL.match(/chrome-extension:\/\/([^/]+)/);
    const extensionId = match?.[1];
    if (!extensionId) {
      throw new Error(`Could not extract extension ID from service worker URL: ${swURL}`);
    }

    await use(extensionId);
  }
});

export { expect } from '@playwright/test';
