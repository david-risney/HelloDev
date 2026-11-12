import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'browser-artifacts', 'chrome-mcp');
await mkdir(output, { recursive: true });
const executable = process.env.HELLODEV_BROWSER_PATH || process.env.EDGE_DEV_PATH || chromium.executablePath();
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    path.join(root, 'node_modules', 'chrome-devtools-mcp', 'build', 'src', 'index.js'),
    '--category-extensions', '--headless', '--isolated', '--viewport=1280x800',
    '--no-usage-statistics', '--no-performance-crux', `--executablePath=${executable}`
  ],
  stderr: 'pipe'
});
const client = new Client({ name: 'hellodev-validation', version: '1.0.0' });
let log = '';
transport.stderr?.on('data', chunk => { log += chunk.toString(); });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  await writeFile(path.join(output, 'tools.json'), JSON.stringify(tools, null, 2));
  const call = async (name, args = {}) => {
    assert(tools.some(tool => tool.name === name), `MCP server is missing ${name}`);
    const response = await client.callTool({ name, arguments: args });
    const text = response.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
    assert(!response.isError, `${name}: ${text}`);
    return text;
  };
  const evaluate = async code => {
    const text = await call('evaluate_script', { function: code });
    const json = text.match(/```json\s*([\s\S]*?)```/);
    assert(json, `Unexpected evaluate_script response: ${text}`);
    return JSON.parse(json[1]);
  };
  const installed = await call('install_extension', { path: path.join(root, 'src') });
  const id = installed.match(/\b[a-p]{32}\b/)?.[0];
  assert(id, `No extension ID in ${installed}`);
  await call('new_page', { url: `chrome-extension://${id}/hellodev.html` });
  await call('wait_for', { text: ['Get Started!'], timeout: 15_000 });
  const baseline = await evaluate(`() => {
    const hour = new Date().getHours();
    return {
      expectedGreeting: 'Good ' + (hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'),
      greeting: document.querySelector('.greeting')?.textContent,
      clock: document.querySelector('.time')?.textContent,
      date: document.querySelector('.date')?.textContent,
      widgets: document.querySelectorAll('.widget').length,
      controls: document.querySelectorAll('.widget-control.config').length,
      toolbar: ['editToggle','addWidgetBtn','customizeBtn','dataBtn','setupBtn','aboutBtn']
        .every(id => document.getElementById(id) instanceof HTMLButtonElement)
    };
  }`);
  assert(baseline.greeting?.includes(baseline.expectedGreeting), 'Incorrect time-based greeting');
  assert.match(baseline.clock || '', /\d/, 'Missing clock');
  assert.match(baseline.date || '', /\d/, 'Missing date');
  assert.equal(baseline.widgets, 3);
  assert.equal(baseline.controls, 3);
  assert(baseline.toolbar, 'Missing toolbar buttons');
  // Show controls for the screenshot without relying on native-host installation.
  await evaluate(`() => {
    document.querySelector('.flyout-close')?.click();
    if (!document.querySelector('#dashboard.edit-mode')) document.querySelector('#editToggle').click();
    return true;
  }`);
  await call('take_snapshot', { filePath: path.join(output, 'snapshot.txt') });
  await call('take_screenshot', { filePath: path.join(output, 'newtab.png'), fullPage: true });
  const consoleErrors = await call('list_console_messages', { types: ['error', 'assert'] });
  await writeFile(path.join(output, 'console.txt'), consoleErrors);
  assert(!/\b(?:error|assert)\]/i.test(consoleErrors), consoleErrors);
  const extensions = await call('list_extensions');
  await writeFile(path.join(output, 'extensions.txt'), extensions);
  assert(extensions.includes(id) && /enabled/i.test(extensions), extensions);

  // Check the browser's own manifest warning list, not just the MCP inventory.
  await call('new_page', { url: 'chrome://extensions' });
  const manifest = await evaluate(`async () => {
    const extensions = await new Promise(resolve => chrome.developerPrivate.getExtensionsInfo({}, resolve));
    const extension = extensions.find(extension => extension.id === '${id}');
    return { state: extension?.state, warnings: extension?.installWarnings,
      errors: extension?.manifestErrors, runtimeErrors: extension?.runtimeErrors };
  }`);
  assert.equal(manifest.state, 'ENABLED');
  assert.equal(manifest.warnings?.length || 0, 0, JSON.stringify(manifest.warnings));
  assert.equal(manifest.errors?.length || 0, 0, JSON.stringify(manifest.errors));
  assert.equal(manifest.runtimeErrors?.length || 0, 0, JSON.stringify(manifest.runtimeErrors));
  const snapshot = await readFile(path.join(output, 'snapshot.txt'), 'utf8');
  for (const text of ['Get Started!', 'Configure', 'Add Widget', 'Manage Data']) assert(snapshot.includes(text), text);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ id, baseline, manifest }, null, 2));
  console.log(`Chrome DevTools MCP validation passed. Artifacts: ${output}`);
} finally {
  await client.close();
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'server.log'), log);
}
