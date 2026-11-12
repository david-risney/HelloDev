import { test, expect, openDashboard, mockDevDash } from './fixtures.js';

test('default dashboard has greeting, clock, onboarding, toolbar and controls without errors', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mockDevDash(page, []);
  await openDashboard(page, extensionId);
  await expect(page.locator('.widget')).toHaveCount(3);
  const hour = await page.evaluate(() => new Date().getHours());
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  await expect(page.locator('.greeting')).toContainText(`Good ${greeting}`);
  await expect(page.locator('.time')).toContainText(/\d/);
  await expect(page.locator('.date')).toContainText(/\d/);
  await expect(page.getByText('Get Started!')).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  for (const name of ['Add Widget', 'Customize Appearance', 'Manage Data', 'DevDash Setup', 'About HelloDev']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Configure', exact: true })).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('newtab.png'), fullPage: true });
  expect(errors).toEqual([]);
});

const row = (id, provider = 'github', kind = 'pr') => ({
  provider, kind, id, title: `Fixture ${provider} ${id}`, state: 'open',
  url: `https://example.com/items/${id}`, repository: 'sample/repo', author: 'Fixture Author',
  assignees: ['Fixture Assignee'], labels: ['test'], draft: false,
  createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z',
  providerData: { commentCount: 2 }
});
const result = (items, nextCursor = null, total = items.length) => ({
  schemaVersion: 1, profile: 'fixture', query: 'work', fetchedAt: '2026-11-12T10:00:00Z',
  queryUrl: 'https://example.com/items', items, page: { total, nextCursor }, stale: true, truncated: true
});
const config = (data = {}) => ({
  id: 'devdash-test', type: 'devdash', x: 0, y: 0, width: 8, height: 6,
  data: { profile: 'fixture', queryName: 'work', refreshInterval: 0, ...data }
});

test('DevDash cards page safely and expose errors without dropping results', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  await mockDevDash(page, [
    result([row('1'), row('2', 'ado', 'bug')], 'next-page', 3),
    result([row('3', 'chromium', 'cl')], null, 3),
    { error: { code: 'AUTH_REQUIRED', message: 'Fixture sign-in required', diagnosticId: 'fixture-request' } }
  ], [config()]);
  await openDashboard(page, extensionId);
  await expect(page.locator('.devdash-item')).toHaveCount(2);
  await expect(page.locator('.devdash-widget')).not.toContainText('STALE');
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('.devdash-item')).toHaveCount(3);
  await expect(page.locator('.devdash-status').last()).toHaveText('3 of 3 cached matches loaded');
  await page.locator('summary').first().click();
  await expect(page.locator('pre').first()).toContainText('commentCount');
  await page.screenshot({ path: testInfo.outputPath('devdash-cards.png'), fullPage: true });
  await page.getByRole('button', { name: 'Read', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Fixture sign-in required');
  await expect(page.locator('.devdash-item')).toHaveCount(3);
  const requests = await page.evaluate(() => window.devdashRequests);
  expect(requests[0]).toMatchObject({ command: 'get', cacheMode: 'adaptive', profile: 'fixture', query: 'work' });
  expect(requests[1].cursor).toBe('next-page');
});

test('DevDash table remains usable in a narrow widget and layout persists', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  await mockDevDash(page, [result([row('1'), row('2', 'ado', 'bug')])], [config({ view: 'table' })]);
  await openDashboard(page, extensionId);
  await expect(page.getByRole('columnheader')).toHaveCount(4);
  await page.setViewportSize({ width: 480, height: 800 });
  await expect(page.getByRole('region', { name: 'Query results' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('devdash-table-narrow.png'), fullPage: true });
  await page.reload();
  await expect(page.locator('.widget-devdash')).toHaveCount(1);
  await expect(page.getByRole('columnheader')).toHaveCount(4);
});

test('legacy work widgets retain identity and persist a credential-free migration', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const widgets = ['adopr', 'adobugs', 'githubpr', 'githubissues', 'gerritcl', 'chromiumbug'].map((type, index) => ({
    id: `old-${type}`, type, x: index % 2 * 4, y: Math.floor(index / 2) * 3, width: 4, height: 3,
    data: { title: `Saved ${type}`, token: 'test-secret', gitcookieToken: 'test-cookie', query: 'old provider query' }
  }));
  await mockDevDash(page, [], widgets);
  await openDashboard(page, extensionId);
  await expect(page.locator('.widget')).toHaveCount(6);
  await expect(page.getByText('This widget now uses DevDash.', { exact: false })).toHaveCount(6);
  const stored = await page.evaluate(async () => ({
    local: JSON.parse(localStorage.getItem('hellodev-widgets')),
    sync: (await chrome.storage.sync.get('hellodev-widgets'))['hellodev-widgets']
  }));
  for (const layout of [stored.local, stored.sync]) {
    expect(layout.widgets.map(widget => widget.id)).toEqual(widgets.map(widget => widget.id));
    expect(JSON.stringify(layout)).not.toContain('test-secret');
    expect(JSON.stringify(layout)).not.toContain('test-cookie');
    expect(JSON.stringify(layout)).not.toContain('old provider query');
  }
});
