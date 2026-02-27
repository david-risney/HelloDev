import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopSitesWidget } from '../../src/widgets/TopSitesWidget.js';

// Minimal chrome mock for topSites
function mockChrome(topSitesData = []) {
  return {
    topSites: {
      get: vi.fn(async () => topSitesData)
    },
    runtime: {
      id: 'mock-extension-id',
      getURL: vi.fn((path) => `chrome-extension://mock-extension-id/${path}`)
    }
  };
}

const SAMPLE_SITES = [
  { url: 'https://github.com', title: 'GitHub' },
  { url: 'https://google.com', title: 'Google' },
  { url: 'https://stackoverflow.com', title: 'Stack Overflow' },
  { url: 'https://developer.mozilla.org', title: 'MDN Web Docs' },
  { url: 'https://news.ycombinator.com', title: 'Hacker News' }
];

describe('TopSitesWidget', () => {
  beforeEach(() => {
    globalThis.chrome = mockChrome(SAMPLE_SITES);
  });

  describe('static metadata', () => {
    it('has correct metadata', () => {
      expect(TopSitesWidget.metadata.name).toBe('Top Sites');
      expect(TopSitesWidget.metadata.icon).toBe('⭐');
      expect(TopSitesWidget.metadata.defaultSize).toEqual({ width: 4, height: 3 });
    });
  });

  describe('constructor', () => {
    it('sets type to topsites', () => {
      const widget = new TopSitesWidget({ id: 'ts1', type: 'topsites', data: {} });
      expect(widget.type).toBe('topsites');
    });

    it('applies default config values', () => {
      const widget = new TopSitesWidget({ id: 'ts2', type: 'topsites', data: {} });
      expect(widget.data.maxItems).toBe(12);
      expect(widget.data.hidePatterns).toEqual([]);
      expect(widget.data.pinnedSites).toEqual([]);
    });

    it('preserves provided config values', () => {
      const widget = new TopSitesWidget({
        id: 'ts3', type: 'topsites',
        data: { maxItems: 8 }
      });
      expect(widget.data.maxItems).toBe(8);
    });
  });

  describe('getConfigSchema', () => {
    it('returns maxItems, hidePatterns, and pinnedSites fields', () => {
      const widget = new TopSitesWidget({ id: 'ts4', type: 'topsites', data: {} });
      const schema = widget.getConfigSchema();
      expect(schema).toHaveLength(3);

      const keys = schema.map(f => f.key);
      expect(keys).toContain('maxItems');
      expect(keys).toContain('hidePatterns');
      expect(keys).toContain('pinnedSites');
    });

    it('hidePatterns is a list type with pattern field', () => {
      const widget = new TopSitesWidget({ id: 'ts5', type: 'topsites', data: {} });
      const field = widget.getConfigSchema().find(f => f.key === 'hidePatterns');
      expect(field.type).toBe('list');
      expect(field.fields[0].key).toBe('pattern');
    });

    it('pinnedSites is a list type with url and title fields', () => {
      const widget = new TopSitesWidget({ id: 'ts6', type: 'topsites', data: {} });
      const field = widget.getConfigSchema().find(f => f.key === 'pinnedSites');
      expect(field.type).toBe('list');
      const fieldKeys = field.fields.map(f => f.key);
      expect(fieldKeys).toContain('url');
      expect(fieldKeys).toContain('title');
    });
  });

  describe('getHideRegexes', () => {
    it('returns empty array when no patterns configured', () => {
      const widget = new TopSitesWidget({ id: 'ts7', type: 'topsites', data: {} });
      expect(widget.getHideRegexes()).toEqual([]);
    });

    it('compiles valid patterns', () => {
      const widget = new TopSitesWidget({
        id: 'ts8', type: 'topsites',
        data: { hidePatterns: [{ pattern: 'google\\.com' }, { pattern: 'github' }] }
      });
      const regexes = widget.getHideRegexes();
      expect(regexes).toHaveLength(2);
      expect(regexes[0].test('https://google.com')).toBe(true);
      expect(regexes[1].test('https://github.com')).toBe(true);
    });

    it('skips invalid regex patterns', () => {
      const widget = new TopSitesWidget({
        id: 'ts9', type: 'topsites',
        data: { hidePatterns: [{ pattern: '[invalid' }, { pattern: 'valid' }] }
      });
      const regexes = widget.getHideRegexes();
      expect(regexes).toHaveLength(1);
      expect(regexes[0].test('valid')).toBe(true);
    });

    it('skips empty/null entries', () => {
      const widget = new TopSitesWidget({
        id: 'ts10', type: 'topsites',
        data: { hidePatterns: [{ pattern: '' }, null, { pattern: 'keep' }] }
      });
      const regexes = widget.getHideRegexes();
      expect(regexes).toHaveLength(1);
    });
  });

  describe('getFaviconUrl', () => {
    it('uses chrome.runtime.getURL when available', () => {
      const url = TopSitesWidget.getFaviconUrl('https://github.com');
      expect(url).toContain('_favicon/');
      expect(url).toContain(encodeURIComponent('https://github.com/'));
    });

    it('uses Google S2 favicon service when chrome.runtime is unavailable', () => {
      const saved = globalThis.chrome;
      globalThis.chrome = undefined;
      const url = TopSitesWidget.getFaviconUrl('https://github.com');
      expect(url).toContain('google.com/s2/favicons');
      expect(url).toContain('github.com');
      globalThis.chrome = saved;
    });

    it('returns empty string for invalid URLs', () => {
      const saved = globalThis.chrome;
      globalThis.chrome = undefined;
      expect(TopSitesWidget.getFaviconUrl('not-a-url')).toBe('');
      globalThis.chrome = saved;
    });
  });

  describe('refresh', () => {
    it('populates sites from chrome.topSites API', async () => {
      const widget = new TopSitesWidget({ id: 'ts11', type: 'topsites', data: {} });
      await widget.refresh();
      expect(widget.sites).toHaveLength(5);
      expect(widget.sites[0].title).toBe('GitHub');
    });

    it('filters sites matching hide patterns', async () => {
      const widget = new TopSitesWidget({
        id: 'ts12', type: 'topsites',
        data: { hidePatterns: [{ pattern: 'google\\.com' }] }
      });
      await widget.refresh();
      expect(widget.sites.every(s => !s.url.includes('google.com'))).toBe(true);
      expect(widget.sites).toHaveLength(4);
    });

    it('prepends pinned sites', async () => {
      const widget = new TopSitesWidget({
        id: 'ts13', type: 'topsites',
        data: {
          pinnedSites: [{ url: 'https://example.com', title: 'Example' }]
        }
      });
      await widget.refresh();
      expect(widget.sites[0].url).toBe('https://example.com');
      expect(widget.sites[0].title).toBe('Example');
    });

    it('does not duplicate pinned sites already in top sites', async () => {
      const widget = new TopSitesWidget({
        id: 'ts14', type: 'topsites',
        data: {
          pinnedSites: [{ url: 'https://github.com', title: 'GitHub Pinned' }]
        }
      });
      await widget.refresh();
      const githubSites = widget.sites.filter(s => s.url.toLowerCase().includes('github.com'));
      expect(githubSites).toHaveLength(1);
    });

    it('limits results to maxItems', async () => {
      const widget = new TopSitesWidget({
        id: 'ts15', type: 'topsites',
        data: { maxItems: 3 }
      });
      await widget.refresh();
      expect(widget.sites).toHaveLength(3);
    });

    it('sets error when API is unavailable', async () => {
      globalThis.chrome = {};
      const widget = new TopSitesWidget({ id: 'ts16', type: 'topsites', data: {} });
      await widget.refresh();
      expect(widget.error).toBeTruthy();
      expect(widget.sites).toEqual([]);
    });

    it('prevents concurrent refreshes', async () => {
      const widget = new TopSitesWidget({ id: 'ts17', type: 'topsites', data: {} });
      // Start a refresh that won't resolve immediately
      const p1 = widget.refresh();
      const p2 = widget.refresh(); // should bail out
      await Promise.all([p1, p2]);
      expect(globalThis.chrome.topSites.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getContent', () => {
    it('renders loading state', () => {
      const widget = new TopSitesWidget({ id: 'ts18', type: 'topsites', data: {} });
      widget.loading = true;
      const html = widget.getContent();
      expect(html).toContain('Loading');
    });

    it('renders error state', () => {
      const widget = new TopSitesWidget({ id: 'ts19', type: 'topsites', data: {} });
      widget.error = 'Something went wrong';
      const html = widget.getContent();
      expect(html).toContain('Something went wrong');
      expect(html).toContain('topsites-retry');
    });

    it('renders empty state', () => {
      const widget = new TopSitesWidget({ id: 'ts20', type: 'topsites', data: {} });
      const html = widget.getContent();
      expect(html).toContain('No frequently visited sites');
    });

    it('renders site tiles with favicons', async () => {
      const widget = new TopSitesWidget({ id: 'ts21', type: 'topsites', data: {} });
      await widget.refresh();
      const html = widget.getContent();
      expect(html).toContain('topsites-grid');
      expect(html).toContain('topsites-tile');
      expect(html).toContain('GitHub');
      expect(html).toContain('https://github.com');
    });

    it('renders grid without inline column style (auto-responsive)', async () => {
      const widget = new TopSitesWidget({
        id: 'ts22', type: 'topsites',
        data: {}
      });
      await widget.refresh();
      const html = widget.getContent();
      expect(html).toContain('topsites-grid');
      expect(html).not.toContain('grid-template-columns');
    });
  });

  describe('getDomainLabel', () => {
    it('extracts hostname without www', () => {
      const widget = new TopSitesWidget({ id: 'ts23', type: 'topsites', data: {} });
      expect(widget.getDomainLabel('https://www.github.com/foo')).toBe('github.com');
    });

    it('returns url for invalid input', () => {
      const widget = new TopSitesWidget({ id: 'ts24', type: 'topsites', data: {} });
      expect(widget.getDomainLabel('not-a-url')).toBe('not-a-url');
    });
  });

  describe('getInitial', () => {
    it('returns first character uppercased', () => {
      const widget = new TopSitesWidget({ id: 'ts25', type: 'topsites', data: {} });
      expect(widget.getInitial('github')).toBe('G');
    });

    it('returns ? for empty string', () => {
      const widget = new TopSitesWidget({ id: 'ts26', type: 'topsites', data: {} });
      expect(widget.getInitial('')).toBe('?');
    });
  });

  describe('destroy', () => {
    it('clears interval', () => {
      const widget = new TopSitesWidget({ id: 'ts27', type: 'topsites', data: {} });
      widget.intervalId = 42;
      widget.destroy();
      expect(widget.intervalId).toBeNull();
    });
  });
});
