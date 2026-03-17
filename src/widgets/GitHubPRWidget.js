import { DataWidgetBase } from './DataWidgetBase.js';
import { GitHubAuthHelper } from '../GitHubAuthHelper.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * GitHub Pull Request Widget
 *
 * Displays pull requests from a GitHub repository using the GitHub REST API.
 * Supports three auth modes:
 *   - 'none'  — unauthenticated (public repos only, 60 req/hr)
 *   - 'pat'   — Personal Access Token entered in widget config
 *   - 'ghcli' — Token acquired automatically via gh CLI native messaging
 *
 * API endpoint: GET /repos/{owner}/{repo}/pulls
 * Docs: https://docs.github.com/en/rest/pulls/pulls#list-pull-requests
 */
export class GitHubPRWidget extends DataWidgetBase {
  static metadata = {
    name: 'GitHub PRs',
    icon: '\u{1F500}',
    group: 'GitHub',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'githubpr' });

    // Defaults
    this.data.owner ??= '';
    this.data.repo ??= '';
    this.data.authMode ??= 'none';
    this.data.token ??= '';
    this.data.state ??= 'open';
    this.data.baseBranch ??= '';
    this.data.author ??= '';
    this.data.labels ??= '';
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
    return !!(this.data.owner && this.data.repo);
  }

  getCachePrefix() { return 'githubpr'; }
  getDefaultTitle() { return 'GitHub PRs'; }
  getEmptyMessage() { return 'No pull requests found'; }
  getConfigureMessage() { return 'Configure owner and repository to see PRs'; }

  getItemDateField(item) {
    return item.updated_at || item.created_at;
  }

  getTitleUrl() {
    if (!this.data.owner || !this.data.repo) return null;
    const owner = encodeURIComponent(this.data.owner);
    const repo = encodeURIComponent(this.data.repo);
    return `https://github.com/${owner}/${repo}/pulls`;
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
      { key: 'owner', label: 'Owner (user or org)', type: 'string', default: '' },
      { key: 'repo', label: 'Repository', type: 'string', default: '' },
      {
        key: 'authMode', label: 'Authentication', type: 'select',
        options: [
          { value: 'none', label: 'None (public repos only)' },
          { value: 'pat', label: 'Personal Access Token' },
          { value: 'ghcli', label: 'GitHub CLI (gh)' }
        ],
        default: 'none'
      },
      { key: 'token', label: 'Personal Access Token (for PAT mode)', type: 'string', default: '' },
      {
        key: 'state', label: 'PR State', type: 'select',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All' }
        ],
        default: 'open'
      },
      { key: 'baseBranch', label: 'Base Branch (optional)', type: 'string', default: '' },
      { key: 'author', label: 'Author(s) (comma-separated, optional)', type: 'string', default: '' },
      { key: 'labels', label: 'Labels (comma-separated, optional)', type: 'string', default: '' },
      { key: 'maxCount', label: 'Max Results', type: 'number', default: 25 },
      { key: 'refreshInterval', label: 'Auto-Refresh (minutes, 0 = off)', type: 'number', default: 60 },
      { key: 'maxAgeDays', label: 'Max Age (days, 0 = no limit)', type: 'number', default: 0 },
      { key: 'sortBy', label: 'Sort By (comma-separated: updated, created, author)', type: 'string', default: '' }
    ];
  }

  getSortableColumns() {
    return {
      'updated': {
        getValue: (item) => item.updated_at,
        type: 'date'
      },
      'created': {
        getValue: (item) => item.created_at,
        type: 'date'
      },
      'author': {
        getValue: (item) => item.user?.login || '',
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
    this.loadingStatus = this.data.authMode === 'ghcli'
      ? 'Obtaining GitHub token...'
      : 'Fetching pull requests...';
    this.error = null;
    this.updateContent();

    try {
      let token = null;
      if (this.data.authMode === 'ghcli') {
        token = await GitHubAuthHelper.getToken();
        this.loadingStatus = 'Fetching pull requests...';
        this.updateContent();
      } else if (this.data.authMode === 'pat' && this.data.token) {
        token = this.data.token;
      }

      this.items = await this.fetchPullRequests(token);
      this.lastFetched = Date.now();
      this.lastServerFetch = this.lastFetched;
      this.saveToCache();
    } catch (err) {
      this.error = this.buildRefreshError(err, 'GitHub');
      this.errorDialogOpen = true;
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  // ---------------------------------------------------------------------------
  // GitHub REST API
  // ---------------------------------------------------------------------------

  async fetchPullRequests(accessToken) {
    const owner = encodeURIComponent(this.data.owner);
    const repo = encodeURIComponent(this.data.repo);
    const params = new URLSearchParams({
      state: this.data.state || 'open',
      per_page: String(this.data.maxCount || 25),
      sort: 'updated',
      direction: 'desc'
    });

    if (this.data.baseBranch) {
      params.set('base', this.data.baseBranch);
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?${params}`;

    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      let body = '';
      try {
        const json = await response.json();
        body = json.message || JSON.stringify(json);
      } catch {
        try { body = await response.text(); } catch { /* ignore */ }
      }

      let message;
      switch (response.status) {
        case 401:
          message = this.data.authMode === 'ghcli'
            ? 'Authentication failed. Try running: gh auth login'
            : 'Authentication failed. Check your personal access token.';
          GitHubAuthHelper.handleAuthError('401');
          break;
        case 403:
          message = body.includes('rate limit')
            ? 'GitHub API rate limit exceeded. Use PAT or gh CLI auth to increase your limit.'
            : `Access denied: ${body || 'Check your permissions.'}`;
          break;
        case 404:
          message = 'Repository not found. Check owner and repository name.';
          break;
        case 422:
          message = `Validation error: ${body || 'Check your filter settings.'}`;
          break;
        default:
          message = `GitHub API error ${response.status}${body ? ': ' + body : ''}`;
      }

      const err = new Error(message);
      err.status = response.status;
      err.details = `HTTP ${response.status} from ${url}${body ? '\n' + body : ''}`;
      throw err;
    }

    let items = await response.json();

    // Client-side author filter (GitHub API doesn't support this param directly)
    if (this.data.author) {
      const authors = this.data.author.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      if (authors.length > 0) {
        items = items.filter(pr => {
          const login = pr.user?.login?.toLowerCase();
          return login && authors.includes(login);
        });
      }
    }

    // Client-side label filter
    if (this.data.labels) {
      const filterLabels = this.data.labels.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
      if (filterLabels.length > 0) {
        items = items.filter(pr => {
          const prLabels = (pr.labels || []).map(l => l.name.toLowerCase());
          return filterLabels.every(fl => prLabels.includes(fl));
        });
      }
    }

    return items;
  }

  // ---------------------------------------------------------------------------
  // Render a single PR item
  // ---------------------------------------------------------------------------

  renderItem(pr) {
    const title = this.escapeHtml(pr.title || '(no title)');
    const author = this.escapeHtml(pr.user?.login || 'Unknown');
    const initials = this.getInitials(pr.user?.login || '?');
    const avatarUrl = pr.user?.avatar_url;
    const age = TimeFormatter.formatRelative(pr.updated_at || pr.created_at);
    const url = pr.html_url || '#';
    const number = pr.number;
    const isDraft = pr.draft;

    const reviewStatus = this.getReviewStatusIcon(pr);
    const stateClass = this.getStateClass(pr);
    const draftBadge = isDraft
      ? '<span class="github-pr-draft" title="Draft">Draft</span>'
      : '';

    const labelHtml = this.renderLabels(pr.labels);

    const avatarHtml = avatarUrl
      ? `<img class="ado-widget-avatar" src="${this.escapeHtml(avatarUrl)}" alt="${author}"><span class="ado-widget-avatar-initials" style="display:none">${initials}</span>`
      : `<span class="ado-widget-avatar-initials">${initials}</span>`;

    return `
      <li class="ado-widget-item ${stateClass}">
        <a href="${url}" target="_blank" class="ado-widget-link" title="${title}">
          <div class="ado-widget-avatar-container">
            ${avatarHtml}
          </div>
          <div class="github-pr-content">
            <div class="github-pr-line1">
              <span class="github-pr-title">${title}</span>
              ${draftBadge}
              <span class="github-pr-review">${reviewStatus}</span>
            </div>
            <div class="github-pr-line2">
              <span class="github-pr-number">#${number}</span>
              <span class="github-pr-author">${author}</span>
              ${labelHtml}
              <span class="github-pr-age">${age}</span>
            </div>
          </div>
        </a>
      </li>
    `;
  }

  renderLabels(labels) {
    if (!labels || labels.length === 0) return '';
    // Show at most 3 labels to save space
    const shown = labels.slice(0, 3);
    return shown.map(label => {
      const name = this.escapeHtml(label.name);
      const color = label.color && /^[0-9a-fA-F]{6}$/.test(label.color)
        ? `#${label.color}` : 'var(--accent)';
      return `<span class="github-pr-label" style="background:${color}" title="${name}">${name}</span>`;
    }).join('');
  }

  getStateClass(pr) {
    if (pr.draft) return 'github-pr-state-draft';
    if (pr.state === 'closed') {
      return pr.merged_at ? 'github-pr-state-merged' : 'github-pr-state-closed';
    }
    return 'github-pr-state-open';
  }

  getReviewStatusIcon(pr) {
    // The list PRs endpoint doesn't include detailed review data, but we can
    // infer from the requested_reviewers field.
    if (pr.requested_reviewers && pr.requested_reviewers.length > 0) {
      return `<span title="Review requested">⏳</span>`;
    }
    if (pr.draft) {
      return `<span title="Draft">📝</span>`;
    }
    return `<span title="Open">👁</span>`;
  }
}
