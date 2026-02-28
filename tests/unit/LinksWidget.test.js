import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinksWidget } from '../../src/widgets/LinksWidget.js';

// Minimal chrome mock for topSites and sessions
function mockChrome(topSitesData = [], sessionsData = []) {
  return {
    topSites: {
      get: vi.fn(async () => topSitesData)
    },
    sessions: {
      getRecentlyClosed: vi.fn(async () => sessionsData)
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

const SAMPLE_SESSIONS = [
  { tab: { url: 'https://example.com/page1', title: 'Example Page 1' } },
  { tab: { url: 'https://example.com/page2', title: 'Example Page 2' } },
  { window: { tabs: [{ url: 'https://example.com/page3', title: 'Example Page 3' }] } }
];

describe('LinksWidget', () => {
  beforeEach(() => {
    globalThis.chrome = mockChrome(SAMPLE_SITES, SAMPLE_SESSIONS);
  });

  describe('static metadata', () => {
    it('has correct metadata', () => {
      expect(LinksWidget.metadata.name).toBe('Links');
      expect(LinksWidget.metadata.icon).toBe('🔗');
      expect(LinksWidget.metadata.defaultSize).toEqual({ width: 4, height: 3 });
    });
  });

  describe('constructor', () => {
    it('sets type to links', () => {
      const widget = new LinksWidget({ id: 'lk1', type: 'links', data: {} });
      expect(widget.type).toBe('links');
    });

    it('applies default config values', () => {
      const widget = new LinksWidget({ id: 'lk2', type: 'links', data: {} });
      expect(widget.data.includeTopSites).toBe(true);
      expect(widget.data.includeRecentlyClosed).toBe(false);
      expect(widget.data.maxItems).toBe(12);
      expect(widget.data.hidePatterns).toEqual([]);
      expect(widget.data.pinnedSites).toEqual([]);
    });

    it('preserves provided config values', () => {
      const widget = new LinksWidget({
        id: 'lk3', type: 'links',
        data: { maxItems: 8, includeTopSites: false }
      });
      expect(widget.data.maxItems).toBe(8);
      expect(widget.data.includeTopSites).toBe(false);
    });
  });

  describe('getConfigSchema', () => {
    it('returns includeTopSites, includeRecentlyClosed, maxItems, hidePatterns, and pinnedSites fields', () => {
      const widget = new LinksWidget({ id: 'lk4', type: 'links', data: {} });
      const schema = widget.getConfigSchema();
      expect(schema).toHaveLength(5);

      const keys = schema.map(f => f.key);
      expect(keys).toContain('includeTopSites');
      expect(keys).toContain('includeRecentlyClosed');
      expect(keys).toContain('maxItems');
      expect(keys).toContain('hidePatterns');
      expect(keys).toContain('pinnedSites');
    });

    it('includeTopSites is a boolean type', () => {
      const widget = new LinksWidget({ id: 'lk5', type: 'links', data: {} });
      const field = widget.getConfigSchema().find(f => f.key === 'includeTopSites');
      expect(field.type).toBe('boolean');
      expect(field.default).toBe(true);
    });

    it('includeRecentlyClosed is a boolean type', () => {
      const widget = new LinksWidget({ id: 'lk6', type: 'links', data: {} });
      const field = widget.getConfigSchema().find(f => f.key === 'includeRecentlyClosed');
      expect(field.type).toBe('boolean');
      expect(field.default).toBe(false);
    });

    it('hidePatterns is a list type with pattern field', () => {
      const widget = new LinksWidget({ id: 'lk7', type: 'links', data: {} });
      const field = widget.getConfigSchema().find(f => f.key === 'hidePatterns');
      expect(field.type).toBe('list');
      expect(field.fields[0].key).toBe('pattern');
    });

    it('pinnedSites is a list type with url and title fields', () => {
      const widget = new LinksWidget({ id: 'lk8', type: 'links', data: {} });
      const field = widget.getConfigSchema().find(f => f.key === 'pinnedSites');
      expect(field.type).toBe('list');
      const fieldKeys = field.fields.map(f => f.key);
      expect(fieldKeys).toContain('url');
      expect(fieldKeys).toContain('title');
    });
  });

  describe('getHideRegexes', () => {
    it('returns empty array when no patterns configured', () => {
      const widget = new LinksWidget({ id: 'lk9', type: 'links', data: {} });
      expect(widget.getHideRegexes()).toEqual([]);
    });

    it('compiles valid patterns', () => {
      const widget = new LinksWidget({
        id: 'lk10', type: 'links',
        data: { hidePatterns: [{ pattern: 'google\\.com' }, { pattern: 'github' }] }
      });
      const regexes = widget.getHideRegexes();
      expect(regexes).toHaveLength(2);
      expect(regexes[0].test('https://google.com')).toBe(true);
      expect(regexes[1].test('https://github.com')).toBe(true);
    });

    it('skips invalid regex patterns', () => {
      const widget = new LinksWidget({
        id: 'lk11', type: 'links',
        data: { hidePatterns: [{ pattern: '[invalid' }, { pattern: 'valid' }] }
      });
      const regexes = widget.getHideRegexes();
      expect(regexes).toHaveLength(1);
      expect(regexes[0].test('valid')).toBe(true);
    });

    it('skips empty/null entries', () => {
      const widget = new LinksWidget({
        id: 'lk12', type: 'links',
        data: { hidePatterns: [{ pattern: '' }, null, { pattern: 'keep' }] }
      });
      const regexes = widget.getHideRegexes();
      expect(regexes).toHaveLength(1);
    });
  });

  describe('getFaviconUrl', () => {
    it('uses chrome.runtime.getURL when available', () => {
      const url = LinksWidget.getFaviconUrl('https://github.com');
      expect(url).toContain('_favicon/');
      expect(url).toContain(encodeURIComponent('https://github.com/'));
    });

    it('uses Google S2 favicon service when chrome.runtime is unavailable', () => {
      const saved = globalThis.chrome;
      globalThis.chrome = undefined;
      const url = LinksWidget.getFaviconUrl('https://github.com');
      expect(url).toContain('google.com/s2/favicons');
      expect(url).toContain('github.com');
      globalThis.chrome = saved;
    });

    it('returns empty string for invalid URLs', () => {
      const saved = globalThis.chrome;
      globalThis.chrome = undefined;
      expect(LinksWidget.getFaviconUrl('not-a-url')).toBe('');
      globalThis.chrome = saved;
    });
  });

  describe('refresh', () => {
    it('populates sites from chrome.topSites API', async () => {
      const widget = new LinksWidget({ id: 'lk13', type: 'links', data: {} });
      await widget.refresh();
      expect(widget.sites).toHaveLength(5);
      expect(widget.sites[0].title).toBe('GitHub');
    });

    it('filters sites matching hide patterns', async () => {
      const widget = new LinksWidget({
        id: 'lk14', type: 'links',
        data: { hidePatterns: [{ pattern: 'google\\.com' }] }
      });
      await widget.refresh();
      expect(widget.sites.every(s => !s.url.includes('google.com'))).toBe(true);
      expect(widget.sites).toHaveLength(4);
    });

    it('prepends pinned sites', async () => {
      const widget = new LinksWidget({
        id: 'lk15', type: 'links',
        data: {
          pinnedSites: [{ url: 'https://example.com', title: 'Example' }]
        }
      });
      await widget.refresh();
      expect(widget.sites[0].url).toBe('https://example.com');
      expect(widget.sites[0].title).toBe('Example');
    });

    it('does not duplicate pinned sites already in top sites', async () => {
      const widget = new LinksWidget({
        id: 'lk16', type: 'links',
        data: {
          pinnedSites: [{ url: 'https://github.com', title: 'GitHub Pinned' }]
        }
      });
      await widget.refresh();
      const githubSites = widget.sites.filter(s => s.url.toLowerCase().includes('github.com'));
      expect(githubSites).toHaveLength(1);
    });

    it('limits results to maxItems', async () => {
      const widget = new LinksWidget({
        id: 'lk17', type: 'links',
        data: { maxItems: 3 }
      });
      await widget.refresh();
      expect(widget.sites).toHaveLength(3);
    });

    it('sets error when API is unavailable', async () => {
      globalThis.chrome = {};
      const widget = new LinksWidget({ id: 'lk18', type: 'links', data: {} });
      await widget.refresh();
      // With both sources disabled/unavailable and no pinned sites, sites is empty
      expect(widget.sites).toEqual([]);
    });

    it('prevents concurrent refreshes', async () => {
      const widget = new LinksWidget({ id: 'lk19', type: 'links', data: {} });
      // Start a refresh that won't resolve immediately
      const p1 = widget.refresh();
      const p2 = widget.refresh(); // should bail out
      await Promise.all([p1, p2]);
      expect(globalThis.chrome.topSites.get).toHaveBeenCalledTimes(1);
    });

    it('includes recently closed tabs when enabled', async () => {
      const widget = new LinksWidget({
        id: 'lk20', type: 'links',
        data: { includeTopSites: false, includeRecentlyClosed: true }
      });
      await widget.refresh();
      expect(widget.sites.length).toBeGreaterThan(0);
      expect(widget.sites.some(s => s.url.includes('example.com/page1'))).toBe(true);
    });

    it('merges top sites and recently closed tabs without duplicates', async () => {
      globalThis.chrome = mockChrome(
        [{ url: 'https://example.com/page1', title: 'Example' }],
        [{ tab: { url: 'https://example.com/page1', title: 'Example Page 1' } }]
      );
      const widget = new LinksWidget({
        id: 'lk21', type: 'links',
        data: { includeTopSites: true, includeRecentlyClosed: true }
      });
      await widget.refresh();
      const matches = widget.sites.filter(s => s.url.includes('example.com/page1'));
      expect(matches).toHaveLength(1);
    });

    it('does not fetch top sites when includeTopSites is false', async () => {
      const widget = new LinksWidget({
        id: 'lk22', type: 'links',
        data: { includeTopSites: false, includeRecentlyClosed: true }
      });
      await widget.refresh();
      expect(globalThis.chrome.topSites.get).not.toHaveBeenCalled();
    });

    it('does not fetch sessions when includeRecentlyClosed is false', async () => {
      const widget = new LinksWidget({
        id: 'lk23', type: 'links',
        data: { includeTopSites: true, includeRecentlyClosed: false }
      });
      await widget.refresh();
      expect(globalThis.chrome.sessions.getRecentlyClosed).not.toHaveBeenCalled();
    });

    it('extracts tabs from window sessions', async () => {
      globalThis.chrome = mockChrome([], [
        { window: { tabs: [
          { url: 'https://win1.example.com', title: 'Win Tab 1' },
          { url: 'https://win2.example.com', title: 'Win Tab 2' }
        ]}}
      ]);
      const widget = new LinksWidget({
        id: 'lk24', type: 'links',
        data: { includeTopSites: false, includeRecentlyClosed: true }
      });
      await widget.refresh();
      expect(widget.sites).toHaveLength(2);
      expect(widget.sites[0].url).toBe('https://win1.example.com');
    });
  });

  describe('getContent', () => {
    it('renders loading state', () => {
      const widget = new LinksWidget({ id: 'lk25', type: 'links', data: {} });
      widget.loading = true;
      const html = widget.getContent();
      expect(html).toContain('Loading');
    });

    it('renders error state', () => {
      const widget = new LinksWidget({ id: 'lk26', type: 'links', data: {} });
      widget.error = 'Something went wrong';
      const html = widget.getContent();
      expect(html).toContain('Something went wrong');
      expect(html).toContain('topsites-retry');
    });

    it('renders empty state', () => {
      const widget = new LinksWidget({ id: 'lk27', type: 'links', data: {} });
      const html = widget.getContent();
      expect(html).toContain('No links to show yet');
    });

    it('renders site tiles with favicons', async () => {
      const widget = new LinksWidget({ id: 'lk28', type: 'links', data: {} });
      await widget.refresh();
      const html = widget.getContent();
      expect(html).toContain('topsites-grid');
      expect(html).toContain('topsites-tile');
      expect(html).toContain('GitHub');
      expect(html).toContain('https://github.com');
    });

    it('renders grid without inline column style (auto-responsive)', async () => {
      const widget = new LinksWidget({
        id: 'lk29', type: 'links',
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
      const widget = new LinksWidget({ id: 'lk30', type: 'links', data: {} });
      expect(widget.getDomainLabel('https://www.github.com/foo')).toBe('github.com');
    });

    it('returns url for invalid input', () => {
      const widget = new LinksWidget({ id: 'lk31', type: 'links', data: {} });
      expect(widget.getDomainLabel('not-a-url')).toBe('not-a-url');
    });
  });

  describe('getInitial', () => {
    it('returns first character uppercased', () => {
      const widget = new LinksWidget({ id: 'lk32', type: 'links', data: {} });
      expect(widget.getInitial('github')).toBe('G');
    });

    it('returns ? for empty string', () => {
      const widget = new LinksWidget({ id: 'lk33', type: 'links', data: {} });
      expect(widget.getInitial('')).toBe('?');
    });
  });

  describe('destroy', () => {
    it('clears interval', () => {
      const widget = new LinksWidget({ id: 'lk34', type: 'links', data: {} });
      widget.intervalId = 42;
      widget.destroy();
      expect(widget.intervalId).toBeNull();
    });
  });
});
