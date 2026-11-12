import { test as base, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const test = base.extend({
  context: async ({}, use) => {
    const executablePath = process.env.HELLODEV_BROWSER_PATH || process.env.EDGE_DEV_PATH;
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: process.env.HELLODEV_HEADED !== '1',
      ...(executablePath ? { executablePath } : {}),
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${path.join(root, 'src')}`,
        `--load-extension=${path.join(root, 'src')}`,
        '--no-first-run',
        '--disable-default-apps'
      ]
    });
    try { await use(context); } finally { await context.close(); }
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  }
});

export async function openDashboard(page, extensionId) {
  await page.goto(`chrome-extension://${extensionId}/hellodev.html`);
  await page.locator('.widget').first().waitFor();
}

// Fixtures exercise the real extension UI without provider credentials or registry changes.
export async function mockDevDash(page, responses, widgets) {
  await page.addInitScript(({ responses, widgets }) => {
    if (location.protocol !== 'chrome-extension:') return;
    window.devdashRequests = [];
    chrome.runtime.sendMessage = async () => ({ installed: true });
    chrome.runtime.connectNative = name => {
      if (name !== 'com.devdash.cli') throw new Error('Unexpected native host');
      let receive;
      return {
        onMessage: { addListener: listener => { receive = listener; } },
        onDisconnect: { addListener() {} },
        disconnect() {},
        postMessage(request) {
          window.devdashRequests.push(request);
          const response = responses[Math.min(window.devdashRequests.length - 1, responses.length - 1)];
          queueMicrotask(() => receive(response));
        }
      };
    };
    if (widgets) {
      localStorage.setItem('hellodev-widgets', JSON.stringify({
        version: 1, widgets, themeMode: 'dark', lastModified: Date.now()
      }));
    }
  }, { responses, widgets });
}

export { expect } from '@playwright/test';
