import { WidgetBase } from './WidgetBase.js';
import { GerritAuthHelper } from '../GerritAuthHelper.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * Gerrit CL Review Widget
 *
 * Displays a list of Chromium (or any Gerrit instance) code-review CLs.
 * Supports two auth modes:
 *   - gitcookies : HTTP Basic auth with token from chromium.googlesource.com/new-password
 *   - anonymous  : No auth – only public data visible
 *
 * Gerrit REST API returns JSON prefixed with )]}\' which must be stripped.
 * Authenticated requests use the /a/ prefix on all endpoints.
 */
export class GerritCLWidget extends WidgetBase {
  static metadata = {
    name: 'Gerrit CLs',
    icon: '🔍',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'gerritcl' });

    // State
    this.items = [];
    this.loading = false;
    this.loadingStatus = '';
    this.error = null;
    this.errorDialogOpen = false;
    this.lastFetched = null;
    this.lastServerFetch = null;
    this.intervalId = null;

    // Defaults
    this.data.gerritHost ??= 'https://chromium-review.googlesource.com';
    this.data.query ??= 'status:open';
    this.data.authMode ??= 'anonymous';
    this.data.gitcookieToken ??= '';
    this.data.maxCount ??= 25;
    this.data.refreshInterval ??= 5;
    this.data.title ??= '';
    this.data.maxAgeDays ??= 0;

    // Restore cache
    this.restoreFromCache();
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  get isConfigured() {
    return !!(this.data.gerritHost && this.data.query);
  }

  getConfigSchema() {
    return [
      { key: 'title', label: 'Widget Title (optional)', type: 'string', default: '' },
      {
        key: 'gerritHost', label: 'Gerrit Host URL', type: 'string',
        default: 'https://chromium-review.googlesource.com'
      },
      {
        key: 'query', label: 'Search Query', type: 'string',
        default: 'status:open'
      },
      {
        key: 'authMode', label: 'Authentication', type: 'select',
        options: [
          { value: 'anonymous', label: 'Anonymous (public CLs only)' },
          { value: 'gitcookies', label: 'Git Cookies' }
        ],
        default: 'anonymous'
      },
      {
        key: 'gitcookieToken', label: 'Git Cookie Token (from chromium.googlesource.com/new-password)',
        type: 'string', default: ''
      },
      { key: 'maxCount', label: 'Max Results', type: 'number', default: 25 },
      { key: 'refreshInterval', label: 'Auto-Refresh (minutes, 0 = off)', type: 'number', default: 5 },
      { key: 'maxAgeDays', label: 'Max Age (days, 0 = no limit)', type: 'number', default: 0 }
    ];
  }

  setConfig(values) {
    const refreshNeeded =
      values.gerritHost !== this.data.gerritHost ||
      values.query !== this.data.query ||
      values.authMode !== this.data.authMode ||
      values.maxCount !== this.data.maxCount;

    super.setConfig(values);

    if (refreshNeeded) {
      this.clearCache();
      this.items = [];
      this.lastFetched = null;
      this.error = null;
      if (this.element) this.refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Cache
  // ---------------------------------------------------------------------------

  getCacheKey() {
    return `gerritcl_cache_${this.id}`;
  }

  restoreFromCache() {
    try {
      const raw = localStorage.getItem(this.getCacheKey());
      if (!raw) return;
      const cached = JSON.parse(raw);
      this.items = cached.items || [];
      this.lastFetched = cached.lastFetched || null;
    } catch (e) {
      console.error('[GerritCLWidget] Cache restore error:', e);
    }
  }

  saveToCache() {
    try {
      localStorage.setItem(this.getCacheKey(), JSON.stringify({
        items: this.items,
        lastFetched: this.lastFetched
      }));
    } catch (e) {
      console.error('[GerritCLWidget] Cache save error:', e);
    }
  }

  clearCache() {
    try {
      localStorage.removeItem(this.getCacheKey());
    } catch (e) {
      console.error('[GerritCLWidget] Cache clear error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch lifecycle
  // ---------------------------------------------------------------------------

  async refresh() {
    if (this.loading || !this.isConfigured) return;

    this.loading = true;
    this.loadingStatus = 'Fetching CLs...';
    this.error = null;
    this.updateContent();

    try {
      const authHeader = await GerritAuthHelper.getAuthHeader(
        this.data.authMode,
        { token: this.data.gitcookieToken }
      );

      this.loadingStatus = 'Querying Gerrit...';
      this.updateContent();

      this.items = await this.fetchChanges(authHeader);
      this.lastFetched = Date.now();
      this.lastServerFetch = this.lastFetched;
      this.saveToCache();
    } catch (err) {
      const originalError = err.details
        ? `\n\n--- Original Error ---\n${err.details}`
        : `\n\n--- Original Error ---\n${err.message || 'Unknown error'}\n${err.stack || ''}`;

      if (!navigator.onLine) {
        this.error = {
          message: 'You appear to be offline',
          details: 'Please check your internet connection and try again. Cached data (if available) is still being displayed.' + originalError
        };
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        this.error = {
          message: 'Network error',
          details: 'Could not connect to Gerrit. This may be a DNS issue, firewall, or the service may be temporarily unavailable.' + originalError
        };
      } else {
        this.error = {
          message: err.message || 'Failed to fetch CLs',
          details: err.details || err.stack || null
        };
      }
      this.errorDialogOpen = true;
      GerritAuthHelper.handleAuthError(this.error.message);
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  // ---------------------------------------------------------------------------
  // Gerrit REST API
  // ---------------------------------------------------------------------------

  async fetchChanges(authHeader) {
    const host = this.data.gerritHost.replace(/\/+$/, '');
    const prefix = authHeader ? '/a' : '';
    const params = new URLSearchParams({
      q: this.data.query,
      n: String(this.data.maxCount || 25),
      o: 'DETAILED_LABELS',
      // Additional option params — Gerrit allows repeated 'o' keys
    });
    // Gerrit supports repeated query params; URLSearchParams.append works
    params.append('o', 'DETAILED_ACCOUNTS');
    params.append('o', 'CURRENT_REVISION');
    params.append('o', 'CURRENT_COMMIT');
    params.append('o', 'MESSAGES');

    const url = `${host}${prefix}/changes/?${params}`;

    const headers = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Check your auth settings.`);
      }
      throw new Error(`Gerrit API error: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return this.parseGerritResponse(text);
  }

  /**
   * Strip Gerrit's XSSI guard prefix )]}' and parse JSON.
   */
  parseGerritResponse(text) {
    const cleaned = text.replace(/^\)\]\}'\n?/, '');
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error('Failed to parse Gerrit response as JSON.');
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  getFilteredItems() {
    if (!this.data.maxAgeDays || this.data.maxAgeDays <= 0) {
      return this.items;
    }
    const cutoffTime = Date.now() - this.data.maxAgeDays * 24 * 60 * 60 * 1000;
    return this.items.filter(cl => {
      const dateStr = cl.updated || cl.created;
      if (!dateStr) return true;
      return new Date(dateStr).getTime() >= cutoffTime;
    });
  }

  getContent() {
    if (!this.isConfigured) {
      return `
        <div class="ado-widget-empty">
          <div class="ado-widget-icon">🔧</div>
          <p>Configure a Gerrit host and query to see CLs</p>
        </div>
      `;
    }

    const lastFetchedStr = this.lastFetched
      ? TimeFormatter.formatRelative(this.lastFetched)
      : '';

    const displayTitle = this.escapeHtml(this.data.title || 'Gerrit CLs');
    const titleUrl = this.getTitleUrl();
    const titleHtml = titleUrl
      ? `<a href="${titleUrl}" target="_blank" class="ado-widget-title-link">${displayTitle}</a>`
      : `<span class="ado-widget-title">${displayTitle}</span>`;

    let statusHtml = '';
    if (this.loading) {
      statusHtml = `<span class="ado-widget-status-indicator ado-widget-status-loading" title="${this.loadingStatus || 'Loading...'}">⟳</span>`;
    } else if (this.error) {
      statusHtml = `<button class="ado-widget-status-indicator ado-widget-status-error ado-widget-error-btn" title="Click to see error details">⚠️</button>`;
    }

    let errorDialogHtml = '';
    if (this.error && this.errorDialogOpen) {
      const errorMessage = this.escapeHtml(this.error.message || this.error);
      const errorDetails = this.error.details
        ? `<pre class="ado-widget-error-details">${this.escapeHtml(this.error.details)}</pre>` : '';
      errorDialogHtml = `
        <div class="ado-widget-error-dialog">
          <div class="ado-widget-error-dialog-header">
            <span>Error</span>
            <button class="ado-widget-error-dialog-close" title="Close">✕</button>
          </div>
          <div class="ado-widget-error-dialog-content">
            <p class="ado-widget-error-message">${errorMessage}</p>
            ${errorDetails}
          </div>
          <div class="ado-widget-error-dialog-actions">
            <button class="ado-widget-error-copy" title="Copy error to clipboard">Copy</button>
            <button class="ado-widget-retry">Retry</button>
          </div>
        </div>
      `;
    }

    const filteredItems = this.getFilteredItems();

    let listContent;
    if (filteredItems.length === 0 && !this.loading) {
      listContent = `
        <div class="ado-widget-empty">
          <div class="ado-widget-icon">✓</div>
          <p>No CLs found</p>
        </div>
      `;
    } else {
      listContent = `
        <ul class="ado-widget-list">
          ${filteredItems.map(cl => this.renderItem(cl)).join('')}
        </ul>
      `;
    }

    return `
      <div class="ado-widget-header">
        ${titleHtml}
        <span class="ado-widget-last-updated" title="Last updated">${lastFetchedStr}</span>
        ${statusHtml}
        <button class="ado-widget-refresh" title="Reload">⟳</button>
      </div>
      ${listContent}
      ${errorDialogHtml}
    `;
  }

  getTitleUrl() {
    if (!this.data.gerritHost || !this.data.query) return null;
    const host = this.data.gerritHost.replace(/\/+$/, '');
    return `${host}/q/${encodeURIComponent(this.data.query)}`;
  }

  // ---------------------------------------------------------------------------
  // Render a single CL item
  // ---------------------------------------------------------------------------

  renderItem(cl) {
    const number = cl._number;
    const subject = this.escapeHtml(cl.subject || '(no subject)');
    const owner = this.escapeHtml(cl.owner?.name || cl.owner?.email || 'Unknown');
    const initials = this.getInitials(cl.owner?.name || cl.owner?.email || '?');
    const age = TimeFormatter.formatRelative(cl.updated || cl.created);
    const host = this.data.gerritHost.replace(/\/+$/, '');
    const url = `${host}/c/${cl.project || ''}/+/${number}`;

    // Code-Review label
    const crLabel = this.getCodeReviewLabel(cl);

    // Insertions / Deletions
    const statsHtml = this.getStatsHtml(cl);

    // Unresolved comments count
    const unresolvedCount = cl.unresolved_comment_count || 0;
    const commentsHtml = unresolvedCount > 0
      ? `<span class="gerrit-cl-comments" title="${unresolvedCount} unresolved comment${unresolvedCount !== 1 ? 's' : ''}">💬${unresolvedCount}</span>`
      : '';

    return `
      <li class="ado-widget-item">
        <a href="${url}" target="_blank" class="ado-widget-link">
          <div class="ado-widget-avatar-container">
            <span class="ado-widget-avatar-initials">${initials}</span>
          </div>
          <div class="gerrit-cl-content">
            <div class="gerrit-cl-line1">
              <span class="gerrit-cl-subject">${subject}</span>
              ${crLabel}
            </div>
            <div class="gerrit-cl-line2">
              <span class="gerrit-cl-number">${number}</span>
              <span class="gerrit-cl-owner">${owner}</span>
              ${statsHtml}
              ${commentsHtml}
              <span class="gerrit-cl-age">${age}</span>
            </div>
          </div>
        </a>
      </li>
    `;
  }

  /**
   * Return an HTML badge for the Code-Review label.
   */
  getCodeReviewLabel(cl) {
    const labels = cl.labels?.['Code-Review'];
    if (!labels) return '';

    // Check for approvals/rejections
    if (labels.rejected) return '<span class="gerrit-cl-label gerrit-cl-label-minus2" title="Code-Review -2">CR-2</span>';
    if (labels.disliked) return '<span class="gerrit-cl-label gerrit-cl-label-minus1" title="Code-Review -1">CR-1</span>';
    if (labels.approved) return '<span class="gerrit-cl-label gerrit-cl-label-plus2" title="Code-Review +2">CR+2</span>';
    if (labels.recommended) return '<span class="gerrit-cl-label gerrit-cl-label-plus1" title="Code-Review +1">CR+1</span>';

    return '<span class="gerrit-cl-label gerrit-cl-label-none" title="Code-Review 0">CR</span>';
  }

  getStatsHtml(cl) {
    const ins = cl.insertions ?? 0;
    const del = cl.deletions ?? 0;
    if (ins === 0 && del === 0) return '';
    const parts = [];
    if (ins > 0) parts.push(`<span class="gerrit-cl-stat-ins">+${ins}</span>`);
    if (del > 0) parts.push(`<span class="gerrit-cl-stat-del">-${del}</span>`);
    return `<span class="gerrit-cl-stats">${parts.join('')}</span>`;
  }

  // ---------------------------------------------------------------------------
  // Behavior & auto-refresh
  // ---------------------------------------------------------------------------

  updateContent() {
    if (!this.element) return;
    const contentEl = this.element.querySelector('.widget-content');
    if (!contentEl) return;
    contentEl.innerHTML = this.getContent();
  }

  setupBehavior(element) {
    element.addEventListener('click', (e) => {
      if (e.target.classList.contains('ado-widget-refresh') ||
          e.target.classList.contains('ado-widget-retry')) {
        e.preventDefault();
        e.stopPropagation();
        this.errorDialogOpen = false;
        this.refresh();
      }
      if (e.target.classList.contains('ado-widget-error-btn')) {
        e.preventDefault();
        e.stopPropagation();
        this.errorDialogOpen = !this.errorDialogOpen;
        this.updateContent();
      }
      if (e.target.classList.contains('ado-widget-error-dialog-close')) {
        e.preventDefault();
        e.stopPropagation();
        this.errorDialogOpen = false;
        this.updateContent();
      }
      if (e.target.classList.contains('ado-widget-error-copy')) {
        e.preventDefault();
        e.stopPropagation();
        const msg = this.error?.message || this.error || '';
        const details = this.error?.details || '';
        const text = details ? `${msg}\n\n${details}` : msg;
        navigator.clipboard.writeText(text).then(() => {
          e.target.textContent = 'Copied!';
          setTimeout(() => { e.target.textContent = 'Copy'; }, 1500);
        });
      }
    });

    if (this.isConfigured) {
      if (!this.lastFetched) {
        this.refresh();
      } else {
        this.updateContent();
      }
    }
    this.startAutoRefresh();
  }

  startAutoRefresh() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (!this.isConfigured) return;
      if (!this.data.refreshInterval || this.data.refreshInterval <= 0) return;
      const intervalMs = this.data.refreshInterval * 60 * 1000;
      if (!this.lastServerFetch || (Date.now() - this.lastServerFetch) >= intervalMs) {
        this.refresh();
      }
    }, 60000);
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
