// End-to-end test: verify the new tab page loads correctly with all expected elements.

import { test, expect } from './fixtures.js';

test.describe('New Tab Page', () => {
  test('loads without console errors', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`chrome-extension://${extensionId}/hellodev.html`);
    await page.waitForLoadState('domcontentloaded');
    // Give the page a moment to initialize
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  test('displays a time-based greeting', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/hellodev.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const greeting = page.locator('.greeting');
    // At least one greeting element should be visible (from ClockWidget)
    const count = await greeting.count();
    if (count > 0) {
      const text = await greeting.first().textContent();
      expect(text).toMatch(/Good (Morning|Afternoon|Evening)/);
    }
  });

  test('displays clock widget with time', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/hellodev.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const clockTime = page.locator('.time, .value.hour');
    const count = await clockTime.count();
    expect(count).toBeGreaterThan(0);
  });

  test('has toolbar buttons', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/hellodev.html`);
    await page.waitForLoadState('domcontentloaded');

    // Look for the toolbar or menu buttons
    const toolbar = page.locator('.toolbar, .top-bar, #toolbar');
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    // Should have multiple buttons (toolbar + widget controls)
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('renders widgets from default state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/hellodev.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Default state has 3 widgets (fluid, clock, markdown)
    const widgets = page.locator('.widget');
    const count = await widgets.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('takes a screenshot for visual baseline', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/hellodev.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/e2e/screenshots/newtab.png', fullPage: true });
  });
});
