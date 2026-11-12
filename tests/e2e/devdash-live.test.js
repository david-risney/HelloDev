import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { test, expect, openDashboard } from './fixtures.js';

test('real DevDash native protocol feeds public GitHub queries into the extension', async ({ context, extensionId }, testInfo) => {
  test.skip(!process.env.DEVDASH_CHECKOUT, 'Set DEVDASH_CHECKOUT to opt into public network/native-host integration.');
  test.setTimeout(180_000);
  const home = await mkdtemp(path.join(os.tmpdir(), 'hellodev-devdash-test-'));
  const config = path.join(home, 'config.json');
  await writeFile(config, JSON.stringify({
    version: 1,
    profiles: {
      smoke: {
        refreshSeconds: 3600,
        queries: Object.fromEntries(['bugs', 'prs'].map(resource => [resource, {
          provider: 'github', resource, auth: 'anonymous', repository: 'david-risney/HelloDev',
          query: 'is:open', limit: 5
        }]))
      }
    }
  }));
  const child = spawn(process.execPath, [
    path.join(process.env.DEVDASH_CHECKOUT, 'bin', 'devdash-native.js'),
    '--home', home, '--config', config
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let buffer = Buffer.alloc(0);
  let sequence = 0;
  const failPending = error => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };
  child.on('error', failPending);
  child.on('exit', code => failPending(new Error(`Native host exited (${code})`)));
  child.stderr.on('data', () => { /* Provider diagnostics stay in the isolated DevDash home. */ });
  child.stdout.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = os.endianness() === 'LE' ? buffer.readUInt32LE() : buffer.readUInt32BE();
      if (buffer.length < length + 4) break;
      const response = JSON.parse(buffer.subarray(4, length + 4).toString('utf8'));
      buffer = buffer.subarray(length + 4);
      pending.get(response.id)?.resolve(response.error ? { error: response.error } : response.result);
      pending.delete(response.id);
    }
  });
  const request = message => new Promise((resolve, reject) => {
    const id = `smoke-${++sequence}`;
    pending.set(id, { resolve, reject });
    const body = Buffer.from(JSON.stringify({ ...message, id }));
    const header = Buffer.alloc(4);
    if (os.endianness() === 'LE') header.writeUInt32LE(body.length);
    else header.writeUInt32BE(body.length);
    child.stdin.write(Buffer.concat([header, body]));
  });
  try {
    expect(await request({ command: 'hello' })).toMatchObject({ schemaVersion: 1 });
    const page = await context.newPage();
    await page.exposeBinding('helloDevNativeRequest', async (_, message) => request(message));
    await page.addInitScript(() => {
      if (location.protocol !== 'chrome-extension:') return;
      chrome.runtime.sendMessage = async () => ({ installed: true });
      chrome.runtime.connectNative = () => {
        let receive, disconnected = false;
        return {
          onMessage: { addListener: fn => { receive = fn; } },
          onDisconnect: { addListener() {} },
          disconnect() { disconnected = true; },
          postMessage(message) {
            void (async () => {
              const response = await window.helloDevNativeRequest(message);
              if (!disconnected) receive(response);
            })();
          }
        };
      };
      localStorage.setItem('hellodev-widgets', JSON.stringify({
        version: 1, lastModified: Date.now(), themeMode: 'dark',
        widgets: ['bugs', 'prs'].map((queryName, index) => ({
          id: `live-${queryName}`, type: 'devdash', x: index * 6, y: 0, width: 6, height: 6,
          data: { profile: 'smoke', queryName, title: `Public HelloDev ${queryName}`, refreshInterval: 0 }
        }))
      }));
    });
    await openDashboard(page, extensionId);
    await expect(page.locator('.devdash-widget[aria-busy="false"]')).toHaveCount(2, { timeout: 120_000 });
    await expect(page.locator('.devdash-error')).toHaveCount(0);
    await expect(page.locator('.devdash-status').filter({ hasText: /cached matches loaded/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Refresh shared query' }).first().click();
    await expect(page.locator('.devdash-widget[aria-busy="false"]')).toHaveCount(2, { timeout: 120_000 });
    await expect(page.locator('.devdash-error')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('devdash-live.png'), fullPage: true });
  } finally {
    const closed = once(child, 'close');
    child.stdin.end();
    const timeout = setTimeout(() => child.kill(), 5000);
    await closed;
    clearTimeout(timeout);
    await rm(home, { recursive: true, force: true });
  }
});
