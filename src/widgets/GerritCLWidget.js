import { DataWidgetBase } from './DataWidgetBase.js';
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
export class GerritCLWidget extends DataWidgetBase {
  static metadata = {
    name: 'Chromium CLs',
    icon: '🔀',
    group: 'Chromium',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'gerritcl' });

    // Defaults
    this.data.gerritHost ??= 'https://chromium-review.googlesource.com';
    this.data.query ??= 'status:open';
    this.data.ownerFilter ??= '';
    this.data.reviewerFilter ??= '';
    this.data.authMode ??= 'anonymous';
    this.data.gitcookieToken ??= '';
    this.data.maxCount ??= 25;
    this.data.refreshInterval ??= 60;
    this.data.title ??= '';
    this.data.maxAgeDays ??= 0;
    this.data.sortBy ??= '';

    this.restoreFromCache();
  }

  // ---------------------------------------------------------------------------
  // DataWidgetBase overrides
  // ---------------------------------------------------------------------------

  get isConfigured() {
    return !!(this.data.gerritHost && this.data.query);
  }

  getCachePrefix() { return 'gerritcl'; }
  getDefaultTitle() { return 'Chromium CLs'; }
  getEmptyMessage() { return 'No CLs found'; }
  getConfigureMessage() { return 'Configure a Gerrit host and query to see CLs'; }

  getItemDateField(item) {
    return item.updated || item.created;
  }

  getTitleUrl() {
    if (!this.data.gerritHost || !this.data.query) return null;
    const host = this.data.gerritHost.replace(/\/+$/, '');
    return `${host}/q/${encodeURIComponent(this.data.query)}`;
  }

  onContentUpdated(contentEl) {
    contentEl.querySelectorAll('.ado-widget-avatar').forEach(img => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        img.nextElementSibling.style.display = 'flex';
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

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
      { key: 'ownerFilter', label: 'Owner(s) (comma-separated, optional)', type: 'string', default: '' },
      { key: 'reviewerFilter', label: 'Reviewer(s) (comma-separated, optional)', type: 'string', default: '' },
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
      { key: 'refreshInterval', label: 'Auto-Refresh (minutes, 0 = off)', type: 'number', default: 60 },
      { key: 'maxAgeDays', label: 'Max Age (days, 0 = no limit)', type: 'number', default: 0 },
      { key: 'sortBy', label: 'Sort By (comma-separated: updated, created, owner)', type: 'string', default: '' }
    ];
  }

  getSortableColumns() {
    return {
      'updated': {
        getValue: (item) => item.updated,
        type: 'date'
      },
      'created': {
        getValue: (item) => item.created,
        type: 'date'
      },
      'owner': {
        getValue: (item) => item.owner?.name || '',
        type: 'string'
      }
    };
  }

  getDefaultSortColumn() { return 'updated'; }

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
      await this.resolveAvatars(authHeader);
      this.lastFetched = Date.now();
      this.lastServerFetch = this.lastFetched;
      this.saveToCache();
    } catch (err) {
      this.error = this.buildRefreshError(err, 'Gerrit');
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

  buildQuery() {
    let q = this.data.query || 'status:open';

    const owners = (this.data.ownerFilter || '').split(',').map(s => s.trim()).filter(Boolean);
    if (owners.length > 0) {
      const ownerClause = owners.length === 1
        ? `owner:${owners[0]}`
        : `(${owners.map(o => `owner:${o}`).join(' OR ')})`;
      q += ` ${ownerClause}`;
    }

    const reviewers = (this.data.reviewerFilter || '').split(',').map(s => s.trim()).filter(Boolean);
    if (reviewers.length > 0) {
      const reviewerClause = reviewers.length === 1
        ? `reviewer:${reviewers[0]}`
        : `(${reviewers.map(r => `reviewer:${r}`).join(' OR ')})`;
      q += ` ${reviewerClause}`;
    }

    return q;
  }

  async fetchChanges(authHeader) {
    const host = this.data.gerritHost.replace(/\/+$/, '');
    const prefix = authHeader ? '/a' : '';
    const params = new URLSearchParams({
      q: this.buildQuery(),
      n: String(this.data.maxCount || 25),
      o: 'DETAILED_LABELS',
    });
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

  parseGerritResponse(text) {
    const cleaned = text.replace(/^\)\]\}'\n?/, '');
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error('Failed to parse Gerrit response as JSON.');
    }
  }

  async resolveAvatars(authHeader) {
    const host = this.data.gerritHost.replace(/\/+$/, '');
    const prefix = authHeader ? '/a' : '';
    const seen = new Map();

    for (const cl of this.items) {
      const owner = cl.owner;
      if (!owner?._account_id) continue;
      if (owner.avatarDataUrl) continue;
      const id = owner._account_id;
      if (!seen.has(id)) seen.set(id, []);
      seen.get(id).push(owner);
    }

    await Promise.all([...seen.entries()].map(async ([accountId, owners]) => {
      const avatarUrl = `${host}${prefix}/accounts/${accountId}/avatar?s=32`;
      const dataUrl = await this.fetchAvatarAsDataUrl(avatarUrl, authHeader);
      if (dataUrl) {
        for (const o of owners) o.avatarDataUrl = dataUrl;
      }
    }));
  }

  async fetchAvatarAsDataUrl(imageUrl, authHeader) {
    try {
      const headers = {};
      if (authHeader) headers['Authorization'] = authHeader;
      const resp = await fetch(imageUrl, { headers });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      if (!blob.type.startsWith('image/')) return null;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Render a single CL item
  // ---------------------------------------------------------------------------

  renderItem(cl) {
    const number = cl._number;
    const subject = this.escapeHtml(cl.subject || '(no subject)');
    const owner = this.escapeHtml(cl.owner?.name || cl.owner?.email || 'Unknown');
    const initials = this.getInitials(cl.owner?.name || cl.owner?.email || '?');
    const avatarDataUrl = cl.owner?.avatarDataUrl;
    const age = TimeFormatter.formatRelative(cl.updated || cl.created);
    const host = this.data.gerritHost.replace(/\/+$/, '');
    const url = `${host}/c/${cl.project || ''}/+/${number}`;

    const crLabel = this.getCodeReviewLabel(cl);
    const statsHtml = this.getStatsHtml(cl);

    const unresolvedCount = cl.unresolved_comment_count || 0;
    const commentsHtml = unresolvedCount > 0
      ? `<span class="gerrit-cl-comments" title="${unresolvedCount} unresolved comment${unresolvedCount !== 1 ? 's' : ''}">💬${unresolvedCount}</span>`
      : '';

    const avatarHtml = avatarDataUrl
      ? `<img class="ado-widget-avatar" src="${avatarDataUrl}" alt="${owner}"><span class="ado-widget-avatar-initials" style="display:none">${initials}</span>`
      : `<span class="ado-widget-avatar-initials">${initials}</span>`;

    return `
      <li class="ado-widget-item">
        <a href="${this.escapeHtml(url)}" target="_blank" class="ado-widget-link" title="${subject}">
          <div class="ado-widget-avatar-container">
            ${avatarHtml}
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

  getCodeReviewLabel(cl) {
    const labels = cl.labels?.['Code-Review'];
    if (!labels) return '';

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
}
