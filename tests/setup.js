// Global test setup — runs before all test files.
// Installs Chrome API mocks and stubs for browser APIs not available in happy-dom.

import { vi, beforeEach } from 'vitest';
import { createChromeMock, resetChromeMocks } from './mocks/chrome.js';

// Create and install the Chrome API mock globally
const chromeMock = createChromeMock();
vi.stubGlobal('chrome', chromeMock);

// Stub ResizeObserver (not available in happy-dom)
vi.stubGlobal('ResizeObserver', class ResizeObserver {
  constructor(callback) {
    this._callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
});

// Reset mocks between tests
beforeEach(() => {
  resetChromeMocks(chromeMock);
});
