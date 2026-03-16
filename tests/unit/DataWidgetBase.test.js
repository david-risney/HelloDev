import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataWidgetBase } from '../../src/widgets/DataWidgetBase.js';

// Concrete test subclass that implements abstract methods
class TestDataWidget extends DataWidgetBase {
  static metadata = { name: 'Test', icon: '🧪', defaultSize: { width: 3, height: 3 } };

  constructor(config) {
    super({ ...config, type: 'testdata' });
  }

  get isConfigured() { return true; }
  getCachePrefix() { return 'test'; }
  getDefaultTitle() { return 'Test Items'; }

  getItemDateField(item) { return item.date || null; }

  async refresh() {
    // No-op for tests
  }
}

describe('DataWidgetBase', () => {
  describe('getInitials', () => {
    let widget;

    beforeEach(() => {
      widget = new TestDataWidget({ id: 'dw-1', data: {} });
    });

    it('returns "?" for falsy input', () => {
      expect(widget.getInitials(null)).toBe('?');
      expect(widget.getInitials('')).toBe('?');
      expect(widget.getInitials(undefined)).toBe('?');
    });

    it('returns first two chars for single-word name', () => {
      expect(widget.getInitials('Alice')).toBe('AL');
    });

    it('returns initials from first and last name', () => {
      expect(widget.getInitials('John Smith')).toBe('JS');
    });

    it('handles three-part names (first + last)', () => {
      expect(widget.getInitials('Mary Jane Watson')).toBe('MW');
    });

    it('extracts initials from email addresses', () => {
      expect(widget.getInitials('john.smith@example.com')).toBe('JS');
    });

    it('handles hyphenated names', () => {
      expect(widget.getInitials('mary-jane')).toBe('MJ');
    });

    it('handles underscore-separated names', () => {
      expect(widget.getInitials('first_last')).toBe('FL');
    });

    it('handles dot-separated names', () => {
      expect(widget.getInitials('first.last')).toBe('FL');
    });

    it('uppercases the result', () => {
      expect(widget.getInitials('alice bob')).toBe('AB');
    });
  });

  describe('getFilteredItems', () => {
    let widget;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-26T12:00:00Z'));
      widget = new TestDataWidget({ id: 'dw-2', data: {} });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns all items when maxAgeDays is not set', () => {
      widget.items = [{ name: 'a' }, { name: 'b' }];
      expect(widget.getFilteredItems()).toEqual([{ name: 'a' }, { name: 'b' }]);
    });

    it('returns all items when maxAgeDays is 0', () => {
      widget.data.maxAgeDays = 0;
      widget.items = [{ name: 'a' }];
      expect(widget.getFilteredItems()).toEqual([{ name: 'a' }]);
    });

    it('returns all items when maxAgeDays is negative', () => {
      widget.data.maxAgeDays = -1;
      widget.items = [{ name: 'a' }];
      expect(widget.getFilteredItems()).toEqual([{ name: 'a' }]);
    });

    it('filters out items older than maxAgeDays', () => {
      widget.data.maxAgeDays = 7;
      widget.items = [
        { name: 'recent', date: '2026-02-25T12:00:00Z' },  // 1 day ago
        { name: 'old', date: '2026-02-10T12:00:00Z' }       // 16 days ago
      ];
      const filtered = widget.getFilteredItems();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('recent');
    });

    it('keeps items without a date field', () => {
      widget.data.maxAgeDays = 7;
      widget.items = [
        { name: 'no-date' },
        { name: 'recent', date: '2026-02-25T12:00:00Z' }
      ];
      const filtered = widget.getFilteredItems();
      expect(filtered).toHaveLength(2);
    });

    it('keeps items exactly at the cutoff', () => {
      widget.data.maxAgeDays = 7;
      // Exactly 7 days ago
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      widget.items = [{ name: 'boundary', date: cutoffDate }];
      const filtered = widget.getFilteredItems();
      expect(filtered).toHaveLength(1);
    });
  });

  describe('applySorting', () => {
    // Widget with sortable columns for testing
    class SortableWidget extends TestDataWidget {
      getSortableColumns() {
        return {
          'priority': {
            getValue: (item) => item.priority ?? Infinity,
            type: 'numeric'
          },
          'name': {
            getValue: (item) => item.name || '',
            type: 'string'
          },
          'date': {
            getValue: (item) => item.date,
            type: 'date'
          },
          'score': {
            getValue: (item) => item.score || 0,
            type: 'numeric',
            descending: true
          }
        };
      }
      getDefaultSortColumn() { return 'date'; }
    }

    let widget;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-26T12:00:00Z'));
      widget = new SortableWidget({ id: 'sort-1', data: {} });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sorts by default column (date descending) when sortBy is empty', () => {
      widget.items = [
        { name: 'old', date: '2026-02-20T12:00:00Z' },
        { name: 'new', date: '2026-02-25T12:00:00Z' },
        { name: 'mid', date: '2026-02-22T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['new', 'mid', 'old']);
    });

    it('sorts by a single numeric column ascending', () => {
      widget.data.sortBy = 'priority';
      widget.items = [
        { name: 'low', priority: 3, date: '2026-02-25T12:00:00Z' },
        { name: 'high', priority: 1, date: '2026-02-20T12:00:00Z' },
        { name: 'med', priority: 2, date: '2026-02-22T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['high', 'med', 'low']);
    });

    it('sorts by priority then uses date as tiebreaker', () => {
      widget.data.sortBy = 'priority';
      widget.items = [
        { name: 'p1-old', priority: 1, date: '2026-02-20T12:00:00Z' },
        { name: 'p1-new', priority: 1, date: '2026-02-25T12:00:00Z' },
        { name: 'p0', priority: 0, date: '2026-02-22T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['p0', 'p1-new', 'p1-old']);
    });

    it('sorts by multiple columns in order', () => {
      widget.data.sortBy = 'priority, name';
      widget.items = [
        { name: 'Beta', priority: 1, date: '2026-02-25T12:00:00Z' },
        { name: 'Alpha', priority: 1, date: '2026-02-24T12:00:00Z' },
        { name: 'Charlie', priority: 0, date: '2026-02-20T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['Charlie', 'Alpha', 'Beta']);
    });

    it('sorts by string column ascending', () => {
      widget.data.sortBy = 'name';
      widget.items = [
        { name: 'Charlie', date: '2026-02-25T12:00:00Z' },
        { name: 'Alpha', date: '2026-02-24T12:00:00Z' },
        { name: 'Beta', date: '2026-02-20T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['Alpha', 'Beta', 'Charlie']);
    });

    it('supports descending override for numeric columns', () => {
      widget.data.sortBy = 'score';
      widget.items = [
        { name: 'low', score: 10, date: '2026-02-25T12:00:00Z' },
        { name: 'high', score: 100, date: '2026-02-20T12:00:00Z' },
        { name: 'med', score: 50, date: '2026-02-22T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['high', 'med', 'low']);
    });

    it('ignores unknown column names in sortBy', () => {
      widget.data.sortBy = 'nonexistent, priority';
      widget.items = [
        { name: 'low', priority: 2, date: '2026-02-25T12:00:00Z' },
        { name: 'high', priority: 1, date: '2026-02-20T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['high', 'low']);
    });

    it('is case-insensitive for column names', () => {
      widget.data.sortBy = 'Priority';
      widget.items = [
        { name: 'low', priority: 2, date: '2026-02-25T12:00:00Z' },
        { name: 'high', priority: 1, date: '2026-02-20T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['high', 'low']);
    });

    it('handles null values in numeric sort (nulls last)', () => {
      widget.data.sortBy = 'priority';
      widget.items = [
        { name: 'none', date: '2026-02-25T12:00:00Z' },
        { name: 'high', priority: 1, date: '2026-02-20T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['high', 'none']);
    });

    it('does not modify the original items array', () => {
      widget.data.sortBy = 'priority';
      widget.items = [
        { name: 'low', priority: 2, date: '2026-02-25T12:00:00Z' },
        { name: 'high', priority: 1, date: '2026-02-20T12:00:00Z' }
      ];
      widget.getFilteredItems();
      expect(widget.items[0].name).toBe('low');
    });

    it('returns items as-is for 0 or 1 items', () => {
      widget.data.sortBy = 'priority';
      widget.items = [{ name: 'only', priority: 1, date: '2026-02-25T12:00:00Z' }];
      const result = widget.getFilteredItems();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('only');
    });

    it('applies filtering before sorting', () => {
      widget.data.maxAgeDays = 7;
      widget.data.sortBy = 'priority';
      widget.items = [
        { name: 'recent-low', priority: 2, date: '2026-02-25T12:00:00Z' },
        { name: 'old-high', priority: 0, date: '2026-02-01T12:00:00Z' },
        { name: 'recent-high', priority: 1, date: '2026-02-24T12:00:00Z' }
      ];
      const result = widget.getFilteredItems();
      expect(result.map(i => i.name)).toEqual(['recent-high', 'recent-low']);
    });
  });

  describe('buildRefreshError', () => {
    let widget;

    beforeEach(() => {
      widget = new TestDataWidget({ id: 'dw-3', data: {} });
    });

    it('returns offline error when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const err = new Error('fetch failed');
      const result = widget.buildRefreshError(err);

      expect(result.message).toContain('offline');
      expect(result.details).toContain('internet connection');

      // Restore
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('returns network error for TypeError with fetch', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const err = new TypeError('Failed to fetch');
      const result = widget.buildRefreshError(err, 'Azure DevOps');

      expect(result.message).toBe('Network error');
      expect(result.details).toContain('Azure DevOps');
    });

    it('returns generic error for other exceptions', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const err = new Error('Something broke');
      const result = widget.buildRefreshError(err);

      expect(result.message).toBe('Something broke');
    });

    it('includes details from error with details property', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const err = { message: 'API error', details: 'Response: 403 Forbidden' };
      const result = widget.buildRefreshError(err);

      expect(result.details).toContain('403 Forbidden');
    });

    it('includes original error in offline/network error details', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const err = new Error('fetch failed');
      const result = widget.buildRefreshError(err);

      expect(result.details).toContain('Original Error');
      expect(result.details).toContain('fetch failed');

      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });
  });

  describe('cache methods', () => {
    let widget;
    let store;

    beforeEach(() => {
      // Stub localStorage with an in-memory implementation
      store = {};
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => store[key] ?? null),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        removeItem: vi.fn((key) => { delete store[key]; }),
      });
      widget = new TestDataWidget({ id: 'dw-4', data: {} });
    });

    it('getCacheKey returns prefix + id', () => {
      expect(widget.getCacheKey()).toBe('test_cache_dw-4');
    });

    it('saveToCache and restoreFromCache round-trip', () => {
      widget.items = [{ name: 'cached-item' }];
      widget.lastFetched = 12345;
      widget.saveToCache();

      expect(localStorage.setItem).toHaveBeenCalled();

      // Reset and restore
      widget.items = [];
      widget.lastFetched = null;
      widget.restoreFromCache();

      expect(widget.items).toEqual([{ name: 'cached-item' }]);
      expect(widget.lastFetched).toBe(12345);
    });

    it('restoreFromCache handles missing cache gracefully', () => {
      widget.restoreFromCache();
      expect(widget.items).toEqual([]);
    });

    it('restoreFromCache handles corrupted cache gracefully', () => {
      store[widget.getCacheKey()] = 'not-json';
      widget.restoreFromCache();
      expect(widget.items).toEqual([]);
    });

    it('clearCache removes the cache entry', () => {
      widget.items = [{ name: 'a' }];
      widget.saveToCache();
      expect(store[widget.getCacheKey()]).toBeDefined();

      widget.clearCache();
      expect(store[widget.getCacheKey()]).toBeUndefined();
    });
  });

  describe('getContent', () => {
    it('shows configure message when not configured', () => {
      class UnconfiguredWidget extends TestDataWidget {
        get isConfigured() { return false; }
      }
      const widget = new UnconfiguredWidget({ id: 'uc-1', data: {} });
      const html = widget.getContent();
      expect(html).toContain('Configure this widget');
      expect(html).toContain('🔧');
    });

    it('shows empty message when configured but no items', () => {
      const widget = new TestDataWidget({ id: 'dw-5', data: {} });
      widget.items = [];
      const html = widget.getContent();
      expect(html).toContain('No items found');
    });

    it('shows header with title', () => {
      const widget = new TestDataWidget({ id: 'dw-6', data: { title: 'My Widget' } });
      widget.items = [{ name: 'a' }];
      const html = widget.getContent();
      expect(html).toContain('My Widget');
    });

    it('shows loading indicator when loading', () => {
      const widget = new TestDataWidget({ id: 'dw-7', data: {} });
      widget.loading = true;
      widget.items = [{ name: 'a' }];
      const html = widget.getContent();
      expect(html).toContain('ado-widget-status-loading');
    });

    it('shows error indicator when error is set', () => {
      const widget = new TestDataWidget({ id: 'dw-8', data: {} });
      widget.error = { message: 'Failed' };
      widget.items = [{ name: 'a' }];
      const html = widget.getContent();
      expect(html).toContain('ado-widget-status-error');
    });
  });
});
