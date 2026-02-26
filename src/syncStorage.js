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

/**
 * Save dashboard state to chrome.storage.sync.
 * @param {{ version: number, widgets: object[], colorPrimary: string, colorAccent: string, themeMode: string }} payload
 */
export async function saveToSync(payload) {
  if (!syncAvailable) return;
  try {
    await chrome.storage.sync.set({ [SYNC_KEY]: payload });
  } catch (e) {
    console.warn('Failed to save layout to sync storage:', e);
  }
}

/**
 * Load dashboard state from chrome.storage.sync.
 * @returns {Promise<{ version: number, widgets: object[], colorPrimary: string, colorAccent: string, themeMode: string } | null>}
 */
export async function loadFromSync() {
  if (!syncAvailable) return null;
  try {
    const result = await chrome.storage.sync.get(SYNC_KEY);
    const data = result[SYNC_KEY];
    if (data && typeof data === 'object' && data.version === STORAGE_VERSION) {
      return data;
    }
    return null;
  } catch (e) {
    console.warn('Failed to load layout from sync storage:', e);
    return null;
  }
}

/**
 * Remove dashboard state from chrome.storage.sync.
 */
export async function clearSync() {
  if (!syncAvailable) return;
  try {
    await chrome.storage.sync.remove(SYNC_KEY);
  } catch (e) {
    console.warn('Failed to clear sync storage:', e);
  }
}

/**
 * Listen for state changes from other devices (or other tabs).
 * The callback receives the full new state object when the synced state changes.
 * @param {(state: { version: number, widgets: object[], colorPrimary: string, colorAccent: string, themeMode: string }) => void} callback
 */
export function onSyncChanged(callback) {
  if (!syncAvailable) return;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    if (!(SYNC_KEY in changes)) return;

    const newValue = changes[SYNC_KEY].newValue;
    if (newValue && typeof newValue === 'object' && newValue.version === STORAGE_VERSION) {
      callback(newValue);
    }
  });
}
