// Sync dashboard state via chrome.storage.sync
//
// The full dashboard state (widgets + theme) is synced across devices.
// Auth tokens and cached data remain in localStorage only.
// localStorage remains the primary store for fast synchronous reads;
// chrome.storage.sync is written to in parallel and used to replicate
// state changes across devices.

import { STORAGE_KEY, STORAGE_VERSION } from './constants.js';

const SYNC_KEY = STORAGE_KEY; // 'hellodev-widgets'

// chrome.storage is only available inside an extension context.
const syncAvailable = typeof chrome !== 'undefined' && chrome.storage?.sync;

// Per-item byte limit for chrome.storage.sync
const SYNC_QUOTA_BYTES_PER_ITEM = 8192;

function syncLog(...args) {
  console.log('[sync]', ...args);
}

function syncWarn(...args) {
  console.warn('[sync]', ...args);
}

/** Measure the byte size of a JSON-serialised object. */
function measureBytes(obj) {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch {
    return -1;
  }
}

/**
 * Save dashboard state to chrome.storage.sync.
 * @param {{ version: number, widgets: object[], colorPrimary: string, colorAccent: string, themeMode: string, lastModified?: number }} payload
 */
export async function saveToSync(payload) {
  if (!syncAvailable) {
    syncLog('saveToSync: skipped — sync API not available (not in extension context)');
    return;
  }
  try {
    const bytes = measureBytes({ [SYNC_KEY]: payload });
    syncLog(
      `saveToSync: writing ${bytes} bytes (limit ${SYNC_QUOTA_BYTES_PER_ITEM}),`,
      `lastModified=${payload.lastModified ?? 'none'},`,
      `widgets=${payload.widgets?.length ?? 0},`,
      `themeMode=${payload.themeMode}`
    );
    if (bytes > SYNC_QUOTA_BYTES_PER_ITEM) {
      syncWarn(
        `saveToSync: payload (${bytes} bytes) exceeds the per-item quota ` +
        `(${SYNC_QUOTA_BYTES_PER_ITEM} bytes). The write will likely fail — ` +
        `consider removing widgets or reducing widget data.`
      );
    }
    await chrome.storage.sync.set({ [SYNC_KEY]: payload });
    syncLog('saveToSync: success');
  } catch (e) {
    syncWarn('saveToSync: FAILED —', e.message || e);
  }
}

/**
 * Load dashboard state from chrome.storage.sync.
 * @returns {Promise<{ version: number, widgets: object[], colorPrimary: string, colorAccent: string, themeMode: string, lastModified?: number } | null>}
 */
export async function loadFromSync() {
  if (!syncAvailable) {
    syncLog('loadFromSync: skipped — sync API not available');
    return null;
  }
  try {
    const result = await chrome.storage.sync.get(SYNC_KEY);
    const data = result[SYNC_KEY];
    if (!data || typeof data !== 'object') {
      syncLog('loadFromSync: no data in sync storage');
      return null;
    }
    if (data.version !== STORAGE_VERSION) {
      syncLog(
        `loadFromSync: version mismatch — got ${data.version},`,
        `expected ${STORAGE_VERSION}. Ignoring synced data.`
      );
      return null;
    }
    syncLog(
      'loadFromSync: loaded —',
      `lastModified=${data.lastModified ?? 'none'},`,
      `widgets=${data.widgets?.length ?? 0},`,
      `themeMode=${data.themeMode}`
    );
    return data;
  } catch (e) {
    syncWarn('loadFromSync: FAILED —', e.message || e);
    return null;
  }
}

/**
 * Remove dashboard state from chrome.storage.sync.
 */
export async function clearSync() {
  if (!syncAvailable) {
    syncLog('clearSync: skipped — sync API not available');
    return;
  }
  try {
    syncLog('clearSync: removing synced state');
    await chrome.storage.sync.remove(SYNC_KEY);
    syncLog('clearSync: success');
  } catch (e) {
    syncWarn('clearSync: FAILED —', e.message || e);
  }
}

/**
 * Listen for state changes from other devices (or other tabs).
 * The callback receives the full new state object when the synced state changes.
 * @param {(state: { version: number, widgets: object[], colorPrimary: string, colorAccent: string, themeMode: string, lastModified?: number }) => void} callback
 */
export function onSyncChanged(callback) {
  if (!syncAvailable) {
    syncLog('onSyncChanged: skipped — sync API not available');
    return;
  }
  syncLog('onSyncChanged: registering listener');
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    if (!(SYNC_KEY in changes)) return;

    const newValue = changes[SYNC_KEY].newValue;
    syncLog(
      'onSyncChanged: change detected —',
      `version=${newValue?.version},`,
      `lastModified=${newValue?.lastModified ?? 'none'},`,
      `widgets=${newValue?.widgets?.length ?? '?'}`
    );
    if (newValue && typeof newValue === 'object' && newValue.version === STORAGE_VERSION) {
      syncLog('onSyncChanged: version OK, invoking callback');
      callback(newValue);
    } else {
      syncLog('onSyncChanged: ignoring (missing, wrong type, or version mismatch)');
    }
  });
}
