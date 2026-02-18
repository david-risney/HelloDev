import { WidgetBase } from './WidgetBase.js';
import { ADOAuthHelper } from '../ADOAuthHelper.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * Abstract base class for Azure DevOps widgets.
 * Provides shared infrastructure: auth, caching, fetch lifecycle, error handling,
 * auto-refresh, and common UI (header, list, error dialog, empty states).
 *
 * Subclasses must implement the abstract methods listed below.
 */
export class ADOWidgetBase extends WidgetBase {
  static metadata = {
    name: 'ADO Widget',
    icon: '🔷',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super(config);
    this.items = [];
    this.loading = false;
    this.loadingStatus = '';
    this.error = null;
    this.errorDialogOpen = false;
    this.lastFetched = null;
    this.lastServerFetch = null;
    this.intervalId = null;
    this._userIdCache = {};

    // Common defaults
    this.data.organization ??= '';
    this.data.project ??= '';
    this.data.maxCount ??= 10;
    this.data.refreshInterval ??= 60;
    this.data.title ??= '';
    this.data.maxAgeDays ??= 0;

    this.applyDefaults();
    this.restoreFromCache();
  }

  // ---------------------------------------------------------------------------
  // Abstract methods — subclasses MUST implement these
  // ---------------------------------------------------------------------------

  /** Apply subclass-specific this.data defaults. */
  applyDefaults() {}

  /** Cache key prefix, e.g. 'adopr' or 'adobugs'. */
  getCachePrefix() { throw new Error('Subclasses must implement getCachePrefix()'); }

  /** Default display title when none is configured. */
  getDefaultTitle() { return 'Items'; }

  /** Message shown when the item list is empty. */
  getEmptyMessage() { return 'No items found'; }

  /** Message shown when the widget is not yet configured. */
  getConfigureMessage() { return 'Configure organization and project'; }

  /** Return an array of config-schema field objects specific to this subclass. */
  getItemSpecificConfigSchema() { return []; }

  /**
   * Fetch items from the ADO API.
   * @param {string} accessToken - A valid Bearer token
   * @returns {Promise<Array>} The transformed items array
   */
  async fetchItems(accessToken) { throw new Error('Subclasses must implement fetchItems()'); }

  /**
   * Render a single list item as an HTML string.
   * @param {Object} item
   * @returns {string} HTML
   */
  renderItem(item) { throw new Error('Subclasses must implement renderItem()'); }

  // ---------------------------------------------------------------------------
  // Optional overrides
  // ---------------------------------------------------------------------------

  /** URL for the clickable title link, or null for a plain text title. */
  getTitleUrl() { return null; }

  /** Return the date field used for max-age filtering. */
  getItemDateField(item) {
    return item.creationDate || item.createdDate || null;
  }

  get isConfigured() {
    return !!(this.data.organization && this.data.project);
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  getConfigSchema() {
    return [
      { key: 'organization', label: 'Organization', type: 'string', default: '' },
      { key: 'project', label: 'Project', type: 'string', default: '' },
      ...this.getItemSpecificConfigSchema(),
      { key: 'maxCount', label: 'Max Items to Show', type: 'number', default: 10 },
      { key: 'refreshInterval', label: 'Auto Refresh (minutes, 0 = disabled)', type: 'number', default: 60 },
      { key: 'title', label: 'Widget Title (optional)', type: 'string', default: '' },
      { key: 'maxAgeDays', label: 'Max Age in Days (0 = no limit)', type: 'number', default: 0 }
    ];
  }

  setConfig(values) {
    super.setConfig(values);
    this.items = [];
    this.lastFetched = null;
    this.lastServerFetch = null;
    localStorage.removeItem(this.getCacheKey());
    if (this.isConfigured && this.element) {
      this.refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Cache
  // ---------------------------------------------------------------------------

  getCacheKey() {
    return `${this.getCachePrefix()}_cache_${this.id}`;
  }

  restoreFromCache() {
    try {
      const cached = localStorage.getItem(this.getCacheKey());
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data.items)) {
          this.items = data.items;
        } else if (Array.isArray(data.prs)) {
          // Migration: old ADOPRWidget cache format
          this.items = data.prs;
        }
        this.lastFetched = data.lastFetched || null;
      }
    } catch (e) {
      console.error(`[${this.constructor.name}] Cache restore error:`, e);
    }
  }

  saveToCache() {
    try {
      localStorage.setItem(this.getCacheKey(), JSON.stringify({
        items: this.items,
        lastFetched: this.lastFetched
      }));
    } catch (e) {
      console.error(`[${this.constructor.name}] Cache save error:`, e);
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch lifecycle (template method)
  // ---------------------------------------------------------------------------

  async refresh() {
    if (this.loading || !this.isConfigured) return;

    this.loading = true;
    this.loadingStatus = 'Obtaining access token...';
    this.error = null;
    this.updateContent();

    try {
      const accessToken = await ADOAuthHelper.getToken();
      this.items = await this.fetchItems(accessToken);
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
          details: 'Could not connect to Azure DevOps. This may be a DNS issue, firewall blocking the connection, or the service may be temporarily unavailable.' + originalError
        };
      } else {
        this.error = {
          message: err.message || 'Failed to fetch items',
          details: err.details || err.stack || null
        };
      }
      this.errorDialogOpen = true;
      ADOAuthHelper.handleAuthError(this.error.message);
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  getFilteredItems() {
    if (!this.data.maxAgeDays || this.data.maxAgeDays <= 0) {
      return this.items;
    }
    const maxAgeMs = this.data.maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;
    return this.items.filter(item => {
      const dateStr = this.getItemDateField(item);
      if (!dateStr) return true;
      return new Date(dateStr).getTime() >= cutoffTime;
    });
  }

  getContent() {
    if (!this.isConfigured) {
      return `
        <div class="ado-widget-empty">
          <div class="ado-widget-icon">🔧</div>
          <p>${this.getConfigureMessage()}</p>
        </div>
      `;
    }

    const lastFetchedStr = this.lastFetched
      ? TimeFormatter.formatRelative(this.lastFetched)
      : '';

    const displayTitle = this.escapeHtml(this.data.title || this.getDefaultTitle());
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
      const errorDetails = this.error.details ? `<pre class="ado-widget-error-details">${this.escapeHtml(this.error.details)}</pre>` : '';
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
          <p>${this.getEmptyMessage()}</p>
        </div>
      `;
    } else {
      listContent = `
        <ul class="ado-widget-list">
          ${filteredItems.map(item => this.renderItem(item)).join('')}
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

  updateContent() {
    if (!this.element) return;
    const contentEl = this.element.querySelector('.widget-content');
    if (!contentEl) return;
    contentEl.innerHTML = this.getContent();
    contentEl.querySelectorAll('.ado-widget-avatar').forEach(img => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        img.nextElementSibling.style.display = 'flex';
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Behavior
  // ---------------------------------------------------------------------------

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
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatAge(dateString) {
    return TimeFormatter.formatRelative(dateString);
  }

  // ---------------------------------------------------------------------------
  // ADO user resolution
  // ---------------------------------------------------------------------------

  async resolveUserId(emailOrName, accessToken) {
    if (!emailOrName) return null;

    if (this._userIdCache[emailOrName]) {
      return this._userIdCache[emailOrName];
    }

    const org = encodeURIComponent(this.data.organization);
    const url = `https://vssps.dev.azure.com/${org}/_apis/graph/users?api-version=7.0-preview.1&subjectTypes=aad,msa&$top=10`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[${this.constructor.name}] Failed to search users: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const users = data.value || [];
      const searchLower = emailOrName.toLowerCase();
      const user = users.find(u =>
        u.principalName?.toLowerCase() === searchLower ||
        u.displayName?.toLowerCase() === searchLower ||
        u.mailAddress?.toLowerCase() === searchLower
      );

      if (user) {
        const userId = user.originId || user.descriptor;
        this._userIdCache[emailOrName] = userId;
        return userId;
      }

      return await this.resolveUserIdViaIdentities(emailOrName, accessToken);
    } catch (err) {
      console.warn(`[${this.constructor.name}] Error resolving user '${emailOrName}':`, err);
      return null;
    }
  }

  async resolveUserIdViaIdentities(emailOrName, accessToken) {
    const org = encodeURIComponent(this.data.organization);
    const url = `https://vssps.dev.azure.com/${org}/_apis/identities?api-version=7.0&searchFilter=General&filterValue=${encodeURIComponent(emailOrName)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return null;

      const data = await response.json();
      const identities = data.value || [];

      if (identities.length > 0) {
        const userId = identities[0].id;
        this._userIdCache[emailOrName] = userId;
        return userId;
      }

      return null;
    } catch (err) {
      console.warn(`[${this.constructor.name}] Error in identity lookup:`, err);
      return null;
    }
  }
}
