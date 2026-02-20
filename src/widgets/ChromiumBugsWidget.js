import { WidgetBase } from './WidgetBase.js';
import { IssueTrackerAuthHelper } from '../IssueTrackerAuthHelper.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * Chromium Bug / Issue Tracker Widget
 *
 * Displays issues from issues.chromium.org (Google Issue Tracker / Buganizer).
 * Uses the private REST API at https://issuetracker.googleapis.com/v1/.
 *
 * Supports two auth modes:
 *   - oauth : Google OAuth2 via chrome.identity.launchWebAuthFlow
 *   - token : Manual Bearer token (e.g. from browser DevTools)
 */
export class ChromiumBugsWidget extends WidgetBase {
  static metadata = {
    name: 'Chromium Bugs',
    icon: '🐞',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'chromiumbug' });

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
    this.data.query ??= 'status:open';
    this.data.authMode ??= 'oauth';
    this.data.manualToken ??= '';
    this.data.maxCount ??= 25;
    this.data.refreshInterval ??= 60;
    this.data.title ??= '';
    this.data.maxAgeDays ??= 0;

    // Restore cache
    this.restoreFromCache();
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  get isConfigured() {
    return !!this.data.query;
  }

  getConfigSchema() {
    return [
      { key: 'title', label: 'Widget Title (optional)', type: 'string', default: '' },
      { key: 'query', label: 'Issue Tracker Query', type: 'string', default: 'status:open' },
      {
        key: 'authMode', label: 'Authentication', type: 'select',
        options: [
          { value: 'oauth', label: 'Google OAuth' },
          { value: 'token', label: 'Manual Token' }
        ],
        default: 'oauth'
      },
      {
        key: 'manualToken',
        label: 'Access Token (DevTools → Network → any issuetracker.googleapis.com request → Authorization header → copy value after "Bearer ")',
        type: 'string', default: ''
      },
      { key: 'maxCount', label: 'Max Results', type: 'number', default: 25 },
      { key: 'refreshInterval', label: 'Auto-Refresh (minutes, 0 = off)', type: 'number', default: 60 },
      { key: 'maxAgeDays', label: 'Max Age (days, 0 = no limit)', type: 'number', default: 0 }
    ];
  }

  setConfig(values) {
    super.setConfig(values);
    this.clearCache();
    this.items = [];
    this.lastFetched = null;
    this.error = null;
    if (this.element) this.refresh();
  }

  // ---------------------------------------------------------------------------
  // Cache
  // ---------------------------------------------------------------------------

  getCacheKey() {
    return `chromiumbug_cache_${this.id}`;
  }

  restoreFromCache() {
    try {
      const raw = localStorage.getItem(this.getCacheKey());
      if (!raw) return;
      const cached = JSON.parse(raw);
      this.items = cached.items || [];
      this.lastFetched = cached.lastFetched || null;
    } catch (e) {
      console.error('[ChromiumBugsWidget] Cache restore error:', e);
    }
  }

  saveToCache() {
    try {
      localStorage.setItem(this.getCacheKey(), JSON.stringify({
        items: this.items,
        lastFetched: this.lastFetched
      }));
    } catch (e) {
      console.error('[ChromiumBugsWidget] Cache save error:', e);
    }
  }

  clearCache() {
    try {
      localStorage.removeItem(this.getCacheKey());
    } catch (e) {
      console.error('[ChromiumBugsWidget] Cache clear error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch lifecycle
  // ---------------------------------------------------------------------------

  async refresh() {
    if (this.loading || !this.isConfigured) return;

    this.loading = true;
    this.loadingStatus = 'Obtaining access token...';
    this.error = null;
    this.updateContent();

    try {
      const token = await IssueTrackerAuthHelper.getToken(
        this.data.authMode,
        { manualToken: this.data.manualToken }
      );

      this.loadingStatus = 'Querying Issue Tracker...';
      this.updateContent();

      this.items = await this.fetchIssues(token);
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
          details: 'Could not connect to Issue Tracker. This may be a DNS issue, firewall, or the service may be temporarily unavailable.' + originalError
        };
      } else {
        this.error = {
          message: err.message || 'Failed to fetch issues',
          details: err.details || err.stack || null
        };
      }
      this.errorDialogOpen = true;
      IssueTrackerAuthHelper.handleAuthError(this.error.message);
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  // ---------------------------------------------------------------------------
  // Issue Tracker REST API
  // ---------------------------------------------------------------------------

  async fetchIssues(token) {
    const params = new URLSearchParams({
      query: this.data.query,
      pageSize: String(this.data.maxCount || 25),
      orderBy: 'modified_time desc'
    });

    const url = `https://issuetracker.googleapis.com/v1/issues?${params}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Check your auth settings.`);
      }
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Issue Tracker API error: ${response.status} ${response.statusText}${errorBody ? '\n' + errorBody : ''}`);
    }

    const data = await response.json();
    return (data.issues || []).map(issue => this.transformIssue(issue));
  }

  transformIssue(issue) {
    const state = issue.issueState || {};
    return {
      id: issue.issueId,
      title: state.title || '(no title)',
      status: state.status || '',
      priority: state.priority || '',
      severity: state.severity || '',
      componentId: state.componentId || '',
      assignee: state.assignee?.emailAddress || '',
      reporter: state.reporter?.emailAddress || '',
      type: state.type || '',
      createdTime: issue.createdTime || null,
      modifiedTime: issue.modifiedTime || null,
      url: `https://issues.chromium.org/issues/${issue.issueId}`
    };
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  getFilteredItems() {
    if (!this.data.maxAgeDays || this.data.maxAgeDays <= 0) {
      return this.items;
    }
    const cutoffTime = Date.now() - this.data.maxAgeDays * 24 * 60 * 60 * 1000;
    return this.items.filter(item => {
      const dateStr = item.modifiedTime || item.createdTime;
      if (!dateStr) return true;
      return new Date(dateStr).getTime() >= cutoffTime;
    });
  }

  getContent() {
    if (!this.isConfigured) {
      return `
        <div class="ado-widget-empty">
          <div class="ado-widget-icon">🔧</div>
          <p>Configure a query to see Chromium bugs</p>
        </div>
      `;
    }

    const lastFetchedStr = this.lastFetched
      ? TimeFormatter.formatRelative(this.lastFetched)
      : '';
    const lastFetchedTooltip = this.lastFetched
      ? `Last updated ${TimeFormatter.formatAbsoluteShort(this.lastFetched)}`
      : 'Last updated';

    const displayTitle = this.escapeHtml(this.data.title || 'Chromium Bugs');
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
          <p>No issues found</p>
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
        <span class="ado-widget-last-updated" title="${lastFetchedTooltip}">${lastFetchedStr}</span>
        ${statusHtml}
        <button class="ado-widget-refresh" title="Reload">⟳</button>
      </div>
      ${listContent}
      ${errorDialogHtml}
    `;
  }

  getTitleUrl() {
    if (!this.data.query) return null;
    return `https://issues.chromium.org/issues?q=${encodeURIComponent(this.data.query)}`;
  }

  // ---------------------------------------------------------------------------
  // Render a single issue item
  // ---------------------------------------------------------------------------

  renderItem(item) {
    const title = this.escapeHtml(item.title);
    const age = TimeFormatter.formatRelative(item.modifiedTime || item.createdTime);
    const assignee = this.escapeHtml(item.assignee || 'Unassigned');
    const initials = this.getInitials(item.assignee || '?');

    // Priority badge
    const priorityHtml = item.priority
      ? `<span class="chromiumbug-priority ${this.getPriorityClass(item.priority)}">${this.escapeHtml(item.priority)}</span>`
      : '';

    // Status badge
    const statusHtml = item.status
      ? `<span class="chromiumbug-status ${this.getStatusClass(item.status)}">${this.escapeHtml(item.status)}</span>`
      : '';

    return `
      <li class="ado-widget-item">
        <a href="${item.url}" target="_blank" class="ado-widget-link">
          <div class="ado-widget-avatar-container">
            <span class="ado-widget-avatar-initials">${initials}</span>
          </div>
          <div class="chromiumbug-content">
            <div class="chromiumbug-line1">
              <span class="chromiumbug-item-title">${title}</span>
              ${priorityHtml}
            </div>
            <div class="chromiumbug-line2">
              <span class="chromiumbug-item-id">${item.id}</span>
              ${statusHtml}
              <span class="chromiumbug-item-assigned">${assignee}</span>
              <span class="chromiumbug-item-age">${age}</span>
            </div>
          </div>
        </a>
      </li>
    `;
  }

  getPriorityClass(priority) {
    if (!priority) return '';
    const p = priority.toUpperCase();
    if (p === 'P0') return 'priority-p0';
    if (p === 'P1') return 'priority-p1';
    if (p === 'P2') return 'priority-p2';
    if (p === 'P3') return 'priority-p3';
    if (p === 'P4') return 'priority-p4';
    return '';
  }

  getStatusClass(status) {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'NEW' || s === 'ASSIGNED' || s === 'ACCEPTED') return 'status-active';
    if (s === 'FIXED' || s === 'VERIFIED') return 'status-resolved';
    if (s === 'NOT_REPRODUCIBLE' || s === 'INTENDED_BEHAVIOR' || s === 'OBSOLETE' || s === 'INFEASIBLE' || s === 'DUPLICATE') return 'status-closed';
    return '';
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
      this.updateContent();
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
    // For email addresses, use the part before @
    const displayName = name.includes('@') ? name.split('@')[0] : name;
    const parts = displayName.trim().split(/[\s._-]+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
