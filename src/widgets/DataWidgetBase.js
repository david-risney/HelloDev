import { WidgetBase } from './WidgetBase.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * Base class for data-fetching widgets that display a list of items with
 * auto-refresh, caching, error handling, and a shared header/list/error UI.
 *
 * Subclasses must implement:
 *   - get isConfigured        — whether the widget has enough config to fetch
 *   - getCachePrefix()        — short prefix for the localStorage cache key
 *   - refresh()               — fetch data, set this.items, call super.onRefreshSuccess/Error
 *   - renderListContent(items) — return the HTML for the list body
 *
 * Subclasses may override:
 *   - getDefaultTitle()       — default header title
 *   - getEmptyMessage()       — message when no items
 *   - getConfigureMessage()   — message when not configured
 *   - getTitleUrl()           — clickable header link
 *   - getItemDateField(item)  — date accessor for max-age filtering
 */
export class DataWidgetBase extends WidgetBase {
  constructor(config) {
    super(config);

    // Shared data-widget state
    this.items = [];
    this.loading = false;
    this.loadingStatus = '';
    this.error = null;
    this.errorDialogOpen = false;
    this.lastFetched = null;
    this.lastServerFetch = null;
    this.intervalId = null;
  }

  // ---------------------------------------------------------------------------
  // Abstract / override points
  // ---------------------------------------------------------------------------

  get isConfigured() { return true; }
  getCachePrefix() { throw new Error('Subclasses must implement getCachePrefix()'); }
  getDefaultTitle() { return 'Items'; }
  getEmptyMessage() { return 'No items found'; }
  getConfigureMessage() { return 'Configure this widget in settings'; }
  getTitleUrl() { return null; }
  getItemDateField(item) { return null; }

  /**
   * Render the list body from filtered items.
   * Default renders each item via renderItem(). Override for custom layouts.
   */
  renderListContent(items) {
    return `
      <ul class="ado-widget-list">
        ${items.map(item => this.renderItem(item)).join('')}
      </ul>
    `;
  }

  /** Render a single list item. Override in subclasses. */
  renderItem(item) { return ''; }

  // ---------------------------------------------------------------------------
  // Cache
  // ---------------------------------------------------------------------------

  getCacheKey() {
    return `${this.getCachePrefix()}_cache_${this.id}`;
  }

  restoreFromCache() {
    try {
      const cached = localStorage.getItem(this.getCacheKey());
      if (!cached) return;
      const data = JSON.parse(cached);
      if (Array.isArray(data.items)) {
        this.items = data.items;
      }
      this.lastFetched = data.lastFetched || null;
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

  clearCache() {
    try {
      localStorage.removeItem(this.getCacheKey());
    } catch (e) {
      console.error(`[${this.constructor.name}] Cache clear error:`, e);
    }
  }

  // ---------------------------------------------------------------------------
  // Refresh helpers (for subclass use in their refresh() methods)
  // ---------------------------------------------------------------------------

  /**
   * Build a structured error object from a caught exception, with offline and
   * network-error detection. Subclasses call this in their catch block:
   *   this.error = this.buildRefreshError(err, 'service name');
   */
  buildRefreshError(err, serviceName = 'the server') {
    const originalError = err.details
      ? `\n\n--- Original Error ---\n${err.details}`
      : `\n\n--- Original Error ---\n${err.message || 'Unknown error'}\n${err.stack || ''}`;

    if (!navigator.onLine) {
      return {
        message: 'You appear to be offline',
        details: 'Please check your internet connection and try again. Cached data (if available) is still being displayed.' + originalError
      };
    }
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      return {
        message: 'Network error',
        details: `Could not connect to ${serviceName}. This may be a DNS issue, firewall, or the service may be temporarily unavailable.` + originalError
      };
    }
    return {
      message: err.message || 'Failed to fetch data',
      details: err.details || err.stack || null
    };
  }

  // ---------------------------------------------------------------------------
  // Filtering & Sorting
  // ---------------------------------------------------------------------------

  getFilteredItems() {
    let items = this.items;

    if (this.data.maxAgeDays && this.data.maxAgeDays > 0) {
      const cutoffTime = Date.now() - this.data.maxAgeDays * 24 * 60 * 60 * 1000;
      items = items.filter(item => {
        const dateStr = this.getItemDateField(item);
        if (!dateStr) return true;
        return new Date(dateStr).getTime() >= cutoffTime;
      });
    }

    return this.applySorting(items);
  }

  /**
   * Return a map of sortable column definitions.
   * Keys are lowercase column names; values are objects with:
   *   - getValue(item): extract the comparable value
   *   - type: 'date' | 'numeric' | 'string'
   *   - descending (optional): override default direction
   *     (dates default to descending; numeric/string default to ascending)
   */
  getSortableColumns() { return {}; }

  /** Column name (key in getSortableColumns) used as the default sort. */
  getDefaultSortColumn() { return null; }

  /**
   * Sort items according to `this.data.sortBy` (comma-separated column names).
   * Falls back to the default sort column as a tiebreaker.
   */
  applySorting(items) {
    if (items.length <= 1) return items;

    const columns = this.getSortableColumns();
    if (Object.keys(columns).length === 0) return items;

    const sortByStr = (this.data.sortBy || '').trim();
    const sortByNames = sortByStr
      ? sortByStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : [];

    const sortOrder = [];
    for (const name of sortByNames) {
      const col = columns[name];
      if (col) sortOrder.push(col);
    }

    // Always add the default column as a final tiebreaker
    const defaultCol = this.getDefaultSortColumn();
    if (defaultCol) {
      const defaultDef = columns[defaultCol];
      if (defaultDef && !sortOrder.includes(defaultDef)) {
        sortOrder.push(defaultDef);
      }
    }

    if (sortOrder.length === 0) return items;

    return [...items].sort((a, b) => {
      for (const col of sortOrder) {
        const aVal = col.getValue(a);
        const bVal = col.getValue(b);
        let cmp;

        switch (col.type) {
          case 'date': {
            const dateA = aVal ? new Date(aVal).getTime() : 0;
            const dateB = bVal ? new Date(bVal).getTime() : 0;
            cmp = dateA - dateB;
            break;
          }
          case 'numeric': {
            const numA = aVal ?? Infinity;
            const numB = bVal ?? Infinity;
            cmp = numA - numB;
            break;
          }
          default: // string
            cmp = (aVal || '').localeCompare(bVal || '');
        }

        // Default: dates descending, everything else ascending
        const desc = col.descending ?? (col.type === 'date');
        if (desc) cmp = -cmp;

        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

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
    const lastFetchedTooltip = this.lastFetched
      ? `Last updated ${TimeFormatter.formatAbsoluteShort(this.lastFetched)}`
      : 'Last updated';

    const displayTitle = this.escapeHtml(this.data.title || this.getDefaultTitle());
    const titleUrl = this.getTitleUrl();
    const titleHtml = titleUrl
      ? `<a href="${this.escapeHtml(titleUrl)}" target="_blank" class="ado-widget-title-link">${displayTitle}</a>`
      : `<span class="ado-widget-title">${displayTitle}</span>`;

    let statusHtml = '';
    if (this.loading) {
      statusHtml = `<span class="ado-widget-status-indicator ado-widget-status-loading" title="${this.loadingStatus || 'Loading...'}"></span>`;
    } else if (this.error) {
      statusHtml = `<button class="ado-widget-status-indicator ado-widget-status-error ado-widget-error-btn" title="Click to see error details">⚠️</button>`;
    }

    let errorDialogHtml = '';
    if (this.error && this.errorDialogOpen) {
      const errorMessage = this.escapeHtml(this.error.message || this.error);
      const errorDetails = this.error.details ? `<pre class="ado-widget-error-details">${this.escapeHtml(this.error.details)}</pre>` : '';
      const rawMsg = (this.error.message || this.error.toString() || '') + (this.error.details || '');
      const isNativeHostError = /native.?messaging.?host.?not.?found|native.?host|Specified native messaging host not found/i.test(rawMsg);
      const nativeHostHint = isNativeHostError
        ? '<p class="ado-widget-error-hint">The native messaging host is not installed. <a href="#action=setup">Set up the native host</a> to enable this widget.</p>'
        : '';
      errorDialogHtml = `
        <div class="ado-widget-error-dialog">
          <div class="ado-widget-error-dialog-header">
            <span>Error</span>
            <button class="ado-widget-error-dialog-close" title="Close">✕</button>
          </div>
          <div class="ado-widget-error-dialog-content">
            ${nativeHostHint}
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
      listContent = this.renderListContent(filteredItems);
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

  updateContent() {
    if (!this.element) return;
    const contentEl = this.element.querySelector('.widget-content');
    if (!contentEl) return;
    contentEl.innerHTML = this.getContent();
    this.onContentUpdated(contentEl);
  }

  /** Hook called after updateContent() replaces innerHTML. */
  onContentUpdated(contentEl) {}

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
