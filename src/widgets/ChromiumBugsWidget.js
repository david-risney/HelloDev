import { DataWidgetBase } from './DataWidgetBase.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * Chromium Bug / Issue Tracker Widget
 *
 * Displays issues from issues.chromium.org (Google Issue Tracker / Buganizer).
 * Fetches data via the public CSV export endpoint, no authentication required.
 */
export class ChromiumBugsWidget extends DataWidgetBase {
  static metadata = {
    name: 'Chromium Bugs',
    icon: '\u{1F41B}',
    group: 'Chromium',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'chromiumbug' });

    // Defaults
    this.data.query ??= 'status:open';
    this.data.maxCount ??= 25;
    this.data.refreshInterval ??= 60;
    this.data.title ??= '';
    this.data.maxAgeDays ??= 0;

    this.restoreFromCache();
  }

  // ---------------------------------------------------------------------------
  // DataWidgetBase overrides
  // ---------------------------------------------------------------------------

  get isConfigured() {
    return !!this.data.query;
  }

  getCachePrefix() { return 'chromiumbug'; }
  getDefaultTitle() { return 'Chromium Bugs'; }
  getEmptyMessage() { return 'No issues found'; }
  getConfigureMessage() { return 'Configure a query to see Chromium bugs'; }

  getItemDateField(item) {
    return item.modifiedTime;
  }

  getTitleUrl() {
    if (!this.data.query) return null;
    return `https://issues.chromium.org/issues?q=${encodeURIComponent(this.data.query)}`;
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  getConfigSchema() {
    return [
      { key: 'title', label: 'Widget Title (optional)', type: 'string', default: '' },
      { key: 'query', label: 'Issue Tracker Query', type: 'string', default: 'status:open' },
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
  // Fetch lifecycle
  // ---------------------------------------------------------------------------

  async refresh() {
    if (this.loading || !this.isConfigured) return;

    this.loading = true;
    this.loadingStatus = 'Fetching issues CSV...';
    this.error = null;
    this.updateContent();

    try {
      this.items = await this.fetchIssuesViaCsv();
      this.lastFetched = Date.now();
      this.lastServerFetch = this.lastFetched;
      this.saveToCache();
    } catch (err) {
      this.error = this.buildRefreshError(err, 'Issue Tracker');
      this.errorDialogOpen = true;
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  // ---------------------------------------------------------------------------
  // CSV fetch and parsing
  // ---------------------------------------------------------------------------

  async fetchIssuesViaCsv() {
    const columns = 'priority,type,title,assignee,status,issue_id,modified_time';
    const params = new URLSearchParams({
      q: this.data.query,
      s: 'modified_time:desc',
      c: columns,
      h: 'true'
    });

    const url = `https://issues.chromium.org/action/issues/csv?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const err = new Error(`Issue Tracker CSV error: ${response.status} ${response.statusText}`);
      err.details = errorBody || undefined;
      throw err;
    }

    const csvText = await response.text();
    const rows = this.parseCsv(csvText);

    if (rows.length === 0) return [];

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1);
    const maxCount = this.data.maxCount || 25;
    const items = [];

    for (const row of dataRows) {
      if (items.length >= maxCount) break;
      if (row.length < headers.length) continue;

      const record = {};
      for (let i = 0; i < headers.length; i++) {
        record[headers[i]] = row[i]?.trim() || '';
      }

      items.push(this.transformCsvRecord(record));
    }

    return items;
  }

  transformCsvRecord(record) {
    const issueId = record['issue_id'] || record['issueid'] || '';
    return {
      id: issueId,
      title: record['title'] || '(no title)',
      status: record['status'] || '',
      priority: record['priority'] || '',
      type: record['type'] || '',
      assignee: record['assignee'] || '',
      modifiedTime: record['modified_time'] || record['modifiedtime'] || null,
      url: issueId ? `https://issues.chromium.org/issues/${issueId}` : '#'
    };
  }

  parseCsv(text) {
    const rows = [];
    let current = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === ',') {
          current.push(field);
          field = '';
          i++;
        } else if (ch === '\r') {
          i++;
        } else if (ch === '\n') {
          current.push(field);
          field = '';
          if (current.some(f => f !== '')) {
            rows.push(current);
          }
          current = [];
          i++;
        } else {
          field += ch;
          i++;
        }
      }
    }

    if (field || current.length > 0) {
      current.push(field);
      if (current.some(f => f !== '')) {
        rows.push(current);
      }
    }

    return rows;
  }

  // ---------------------------------------------------------------------------
  // Render a single issue item
  // ---------------------------------------------------------------------------

  renderItem(item) {
    const title = this.escapeHtml(item.title);
    const age = item.modifiedTime ? TimeFormatter.formatRelative(item.modifiedTime) : '';
    const assignee = this.escapeHtml(item.assignee || 'Unassigned');
    const initials = this.getInitials(item.assignee || '?');

    const priorityHtml = item.priority
      ? `<span class="chromiumbug-priority ${this.getPriorityClass(item.priority)}">${this.escapeHtml(item.priority)}</span>`
      : '';

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
}
