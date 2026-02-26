import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveToSync, loadFromSync, clearSync, onSyncChanged } from '../../src/syncStorage.js';
import { STORAGE_KEY, STORAGE_VERSION } from '../../src/constants.js';

describe('syncStorage', () => {
  const validPayload = {
    version: STORAGE_VERSION,
    widgets: [{ id: 'w1', type: 'clock' }],
    colorPrimary: '#1a1a2e',
    colorAccent: '#667eea',
    themeMode: 'auto'
  };

  describe('saveToSync', () => {
    it('calls chrome.storage.sync.set with the correct key', async () => {
      await saveToSync(validPayload);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: validPayload
      });
    });
  });

  describe('loadFromSync', () => {
    it('returns the stored payload when version matches', async () => {
      await saveToSync(validPayload);
      const result = await loadFromSync();
      expect(result).toEqual(validPayload);
    });

    it('returns null when nothing is stored', async () => {
      const result = await loadFromSync();
      expect(result).toBeNull();
    });

    it('returns null when stored version does not match', async () => {
      await chrome.storage.sync.set({
        [STORAGE_KEY]: { ...validPayload, version: 999 }
      });
      const result = await loadFromSync();
      expect(result).toBeNull();
    });
  });

  describe('clearSync', () => {
    it('removes the storage key', async () => {
      await saveToSync(validPayload);
      await clearSync();
      expect(chrome.storage.sync.remove).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe('onSyncChanged', () => {
    it('calls callback when synced state changes with valid version', async () => {
      const callback = vi.fn();
      onSyncChanged(callback);

      // Trigger a change by saving
      await saveToSync(validPayload);

      expect(callback).toHaveBeenCalledWith(validPayload);
    });

    it('does not call callback for non-sync area changes', () => {
      const callback = vi.fn();
      onSyncChanged(callback);

      // Manually trigger a 'local' area change via the listener
      const listeners = chrome.storage.onChanged.addListener.mock.calls.map(c => c[0]);
      for (const listener of listeners) {
        listener({ [STORAGE_KEY]: { newValue: validPayload } }, 'local');
      }

      // callback should not have been called for 'local' area
      // (it may have been called by saveToSync above, filter those out)
      const localCalls = callback.mock.calls.filter(() => true);
      // Since we didn't call saveToSync, callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });

    it('does not call callback when version is wrong', () => {
      const callback = vi.fn();
      onSyncChanged(callback);

      // Fire a change with wrong version
      const listeners = chrome.storage.onChanged.addListener.mock.calls.map(c => c[0]);
      for (const listener of listeners) {
        listener({
          [STORAGE_KEY]: { newValue: { ...validPayload, version: 999 } }
        }, 'sync');
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
