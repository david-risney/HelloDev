// Chrome API mock for unit testing.
// Provides in-memory stubs for chrome.storage, chrome.runtime, chrome.identity, etc.

import { vi } from 'vitest';

/** In-memory store backing chrome.storage.sync */
let syncStore = {};

/** Registered chrome.storage.onChanged listeners */
let onChangedListeners = [];

export function createChromeMock() {
  syncStore = {};
  onChangedListeners = [];

  return {
    storage: {
      sync: {
        get: vi.fn(async (keys) => {
          if (typeof keys === 'string') {
            return { [keys]: syncStore[keys] };
          }
          if (Array.isArray(keys)) {
            const result = {};
            for (const k of keys) {
              if (k in syncStore) result[k] = syncStore[k];
            }
            return result;
          }
          // null/undefined = get all
          return { ...syncStore };
        }),
        set: vi.fn(async (items) => {
          const changes = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: syncStore[key], newValue: value };
            syncStore[key] = value;
          }
          // Fire onChanged listeners
          for (const listener of onChangedListeners) {
            listener(changes, 'sync');
          }
        }),
        remove: vi.fn(async (keys) => {
          const keyList = typeof keys === 'string' ? [keys] : keys;
          const changes = {};
          for (const k of keyList) {
            if (k in syncStore) {
              changes[k] = { oldValue: syncStore[k] };
              delete syncStore[k];
            }
          }
          for (const listener of onChangedListeners) {
            listener(changes, 'sync');
          }
        }),
        clear: vi.fn(async () => {
          const changes = {};
          for (const [key, value] of Object.entries(syncStore)) {
            changes[key] = { oldValue: value };
          }
          syncStore = {};
          for (const listener of onChangedListeners) {
            listener(changes, 'sync');
          }
        })
      },
      onChanged: {
        addListener: vi.fn((fn) => {
          onChangedListeners.push(fn);
        }),
        removeListener: vi.fn((fn) => {
          onChangedListeners = onChangedListeners.filter(l => l !== fn);
        })
      }
    },
    runtime: {
      sendMessage: vi.fn(),
      getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
      connectNative: vi.fn(),
      getManifest: vi.fn(() => ({
        name: 'HelloDev',
        version: '1.0.0'
      }))
    },
    identity: {
      launchWebAuthFlow: vi.fn(),
      getRedirectURL: vi.fn(() => 'https://mock-redirect.chromiumapp.org/')
    },
    action: {
      onClicked: {
        addListener: vi.fn()
      }
    },
    tabs: {
      create: vi.fn()
    }
  };
}

/**
 * Reset all mock functions and clear the in-memory store.
 * Call this in beforeEach to start each test with a clean slate.
 */
export function resetChromeMocks(chromeMock) {
  syncStore = {};
  onChangedListeners = [];

  // Reset all vi.fn() mocks recursively
  function resetMocks(obj) {
    for (const value of Object.values(obj)) {
      if (typeof value === 'function' && value._isMockFunction) {
        value.mockClear();
      } else if (value && typeof value === 'object') {
        resetMocks(value);
      }
    }
  }
  resetMocks(chromeMock);

  // Re-wire addListener/removeListener since they were cleared
  chromeMock.storage.onChanged.addListener.mockImplementation((fn) => {
    onChangedListeners.push(fn);
  });
  chromeMock.storage.onChanged.removeListener.mockImplementation((fn) => {
    onChangedListeners = onChangedListeners.filter(l => l !== fn);
  });
}
