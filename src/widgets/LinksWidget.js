import { WidgetBase } from './WidgetBase.js';

/**
 * Links widget — displays a grid of links combining top sites, recently
 * closed tabs, and user-pinned sites.
 *
 * Configuration:
 *   - includeTopSites:    include frequently visited sites (chrome.topSites)
 *   - includeRecentlyClosed: include recently closed tabs (chrome.sessions)
 *   - hidePatterns: list of regex patterns; matching URLs are hidden
 *   - pinnedSites:  list of { url, title } entries that are always shown
 *   - maxItems:     maximum number of sites to display
 */
export class LinksWidget extends WidgetBase {
  static metadata = {
    name: 'Links',
    icon: '🔗',
    group: 'Utility',
    defaultSize: { width: 4, height: 3 }
  };

  constructor(config) {
    super({ ...config, type: 'links' });
    this.sites = [];
    this.loading = false;
    this.error = null;
    this.intervalId = null;

    this.data.includeTopSites ??= true;
    this.data.includeRecentlyClosed ??= false;
    this.data.maxItems ??= 12;
    this.data.hidePatterns ??= [];
    this.data.pinnedSites ??= [];
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  getConfigSchema() {
    return [
      { key: 'includeTopSites', label: 'Include Top Sites', type: 'boolean', default: true },
      { key: 'includeRecentlyClosed', label: 'Recently Closed Tabs', type: 'boolean', default: false },
      { key: 'maxItems', label: 'Max Sites to Show', type: 'number', default: 12 },
      {
        key: 'hidePatterns',
        label: 'Hide URLs matching (regex)',
        type: 'list',
        fields: [
          { key: 'pattern', label: 'URL Regex Pattern', type: 'string' }
        ],
        default: []
      },
      {
        key: 'pinnedSites',
        label: 'Pinned Sites (always shown)',
        type: 'list',
        fields: [
          { key: 'url', label: 'URL', type: 'string' },
          { key: 'title', label: 'Title', type: 'string' }
        ],
        default: []
      }
    ];
  }

  setConfig(values) {
    super.setConfig(values);
    if (this.element) this.refresh();
  }

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  /**
   * Build compiled RegExp objects from the user-supplied hide patterns.
   * Invalid patterns are silently skipped.
   */
  getHideRegexes() {
    const patterns = this.data.hidePatterns || [];
    const regexes = [];
    for (const entry of patterns) {
      const pat = typeof entry === 'string' ? entry : entry?.pattern;
      if (!pat) continue;
      try {
        regexes.push(new RegExp(pat, 'i'));
      } catch {
        // ignore invalid regex
      }
    }
    return regexes;
  }

  /**
   * Return a favicon URL for the given site URL.
   * Uses the Chrome built-in favicon service when available, falling back
   * to the Google S2 favicon service.
   */
  static getFaviconUrl(siteUrl) {
    try {
      const u = new URL(siteUrl);
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        // Chrome built-in favicon API (manifest v3, requires "favicon" permission)
        return chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(u.href)}&size=32`);
      }
      // Fallback to Google's public favicon service
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    } catch {
      return '';
    }
  }

  /**
   * Fetch top sites from the chrome.topSites API and merge with pinned sites
   * and recently closed tabs.
   */
  async refresh() {
    if (this.loading) return;
    this.loading = true;
    this.error = null;
    this.updateContent();

    try {
      let allSites = [];

      // Fetch top sites if enabled
      if (this.data.includeTopSites) {
        try {
          const topSites = await this.fetchTopSites();
          allSites.push(...topSites);
        } catch {
          // Top sites unavailable — continue with other sources
        }
      }

      // Fetch recently closed tabs if enabled
      if (this.data.includeRecentlyClosed) {
        try {
          const recentTabs = await this.fetchRecentlyClosed();
          allSites.push(...recentTabs);
        } catch {
          // Sessions API unavailable — continue with other sources
        }
      }

      const hideRegexes = this.getHideRegexes();

      // Filter out hidden URLs
      const filtered = allSites.filter(site =>
        !hideRegexes.some(re => re.test(site.url))
      );

      // Deduplicate by URL (case-insensitive)
      const seen = new Set();
      const deduped = filtered.filter(s => {
        const key = s.url.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Build a set of already-present URLs (case-insensitive origin+path)
      const urlSet = new Set(deduped.map(s => s.url.toLowerCase()));

      // Prepend pinned sites that aren't already in the list
      const pinned = (this.data.pinnedSites || [])
        .filter(s => s?.url && !urlSet.has(s.url.toLowerCase()));

      const merged = [...pinned, ...deduped];

      const max = Math.max(1, this.data.maxItems || 12);
      this.sites = merged.slice(0, max);

      if (this.sites.length === 0 && !this.data.includeTopSites && !this.data.includeRecentlyClosed && (!this.data.pinnedSites || this.data.pinnedSites.length === 0)) {
        this.error = 'Enable Top Sites or Recently Closed Tabs, or add pinned sites';
      }
    } catch (err) {
      this.error = err.message || 'Failed to load sites';
    } finally {
      this.loading = false;
      this.updateContent();
    }
  }

  /**
   * Wraps the chrome.topSites.get API in a promise.
   * Separated for easy mocking in tests.
   */
  async fetchTopSites() {
    if (typeof chrome === 'undefined' || !chrome.topSites?.get) {
      throw new Error('chrome.topSites API is not available');
    }
    return chrome.topSites.get();
  }

  /**
   * Fetches recently closed tabs via chrome.sessions.getRecentlyClosed.
   * Separated for easy mocking in tests.
   */
  async fetchRecentlyClosed() {
    if (typeof chrome === 'undefined' || !chrome.sessions?.getRecentlyClosed) {
      throw new Error('chrome.sessions API is not available');
    }
    const sessions = await chrome.sessions.getRecentlyClosed();
    // Extract tabs from sessions (sessions can contain tabs or windows)
    const tabs = [];
    for (const session of sessions) {
      if (session.tab && session.tab.url) {
        tabs.push({ url: session.tab.url, title: session.tab.title || '' });
      } else if (session.window?.tabs) {
        for (const tab of session.window.tabs) {
          if (tab.url) {
            tabs.push({ url: tab.url, title: tab.title || '' });
          }
        }
      }
    }
    return tabs;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  getContent() {
    if (this.loading && this.sites.length === 0) {
      return `<div class="topsites-loading">Loading…</div>`;
    }

    if (this.error && this.sites.length === 0) {
      return `
        <div class="topsites-empty">
          <div class="topsites-empty-icon">⚠️</div>
          <p>${this.escapeHtml(this.error)}</p>
          <button class="topsites-retry">Retry</button>
        </div>
      `;
    }

    if (this.sites.length === 0) {
      return `
        <div class="topsites-empty">
          <div class="topsites-empty-icon">🔗</div>
          <p>No links to show yet</p>
        </div>
      `;
    }

    const tiles = this.sites.map(site => {
      const favicon = LinksWidget.getFaviconUrl(site.url);
      const title = this.escapeHtml(site.title || this.getDomainLabel(site.url));
      const href = this.escapeHtml(site.url);
      return `
        <a class="topsites-tile" href="${href}" title="${title}">
          <div class="topsites-favicon">
            <img src="${favicon}" alt="" width="24" height="24" class="topsites-favicon-img">
            <span class="topsites-favicon-fallback">${this.getInitial(title)}</span>
          </div>
          <span class="topsites-label">${title}</span>
        </a>
      `;
    }).join('');

    return `
      <div class="topsites-grid">
        ${tiles}
      </div>
    `;
  }

  updateContent() {
    if (!this.element) return;
    const contentEl = this.element.querySelector('.widget-content');
    if (!contentEl) return;
    contentEl.innerHTML = this.getContent();
  }

  // ---------------------------------------------------------------------------
  // Behavior
  // ---------------------------------------------------------------------------

  setupBehavior(element) {
    element.addEventListener('click', (e) => {
      if (e.target.classList.contains('topsites-retry')) {
        e.preventDefault();
        e.stopPropagation();
        this.refresh();
      }
    });

    // Handle favicon load errors via delegation instead of inline onerror
    element.addEventListener('error', (e) => {
      if (e.target.classList.contains('topsites-favicon-img')) {
        e.target.style.display = 'none';
        const fallback = e.target.nextElementSibling;
        if (fallback) fallback.style.display = 'flex';
      }
    }, true);

    this.refresh();
    // Refresh every 5 minutes to pick up new browsing activity
    this.intervalId = setInterval(() => this.refresh(), 5 * 60 * 1000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  getDomainLabel(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  getInitial(text) {
    return text ? text.charAt(0).toUpperCase() : '?';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
