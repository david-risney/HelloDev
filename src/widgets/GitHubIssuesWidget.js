import { DataWidgetBase } from './DataWidgetBase.js';
import { GitHubAuthHelper } from '../GitHubAuthHelper.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * GitHub Issues Widget
 *
 * Displays issues from a GitHub repository using the GitHub REST API.
 * Supports three auth modes:
 *   - 'none'  — unauthenticated (public repos only, 60 req/hr)
 *   - 'pat'   — Personal Access Token entered in widget config
 *   - 'ghcli' — Token acquired automatically via gh CLI native messaging
 *
 * API endpoint: GET /repos/{owner}/{repo}/issues
 * Docs: https://docs.github.com/en/rest/issues/issues#list-repository-issues
 */
export class GitHubIssuesWidget extends DataWidgetBase {
  static metadata = {
    name: 'GitHub Issues',
    icon: '🐛',
    group: 'GitHub',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'githubissues' });

    // Defaults
    this.data.owner ??= '';
    this.data.repo ??= '';
    this.data.authMode ??= 'none';
    this.data.token ??= '';
    this.data.state ??= 'open';
    this.data.author ??= '';
    this.data.labels ??= '';
    this.data.assignee ??= '';
    this.data.milestone ??= '';
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

  getCachePrefix() { return 'githubissues'; }
  getDefaultTitle() { return 'GitHub Issues'; }
  getEmptyMessage() { return 'No issues found'; }
  getConfigureMessage() { return 'Configure owner and repository to see issues'; }

  getItemDateField(item) {
    return item.updated_at || item.created_at;
  }

  getTitleUrl() {
    if (!this.data.owner || !this.data.repo) return null;
    const owner = encodeURIComponent(this.data.owner);
    const repo = encodeURIComponent(this.data.repo);
    return `https://github.com/${owner}/${repo}/issues`;
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
        key: 'state', label: 'Issue State', type: 'select',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All' }
        ],
        default: 'open'
      },
      { key: 'author', label: 'Author (optional)', type: 'string', default: '' },
      { key: 'labels', label: 'Labels (comma-separated, optional)', type: 'string', default: '' },
      { key: 'assignee', label: 'Assignee (optional)', type: 'string', default: '' },
      { key: 'milestone', label: 'Milestone (number or *, optional)', type: 'string', default: '' },
      { key: 'maxCount', label: 'Max Results', type: 'number', default: 25 },
      { key: 'refreshInterval', label: 'Auto-Refresh (minutes, 0 = off)', type: 'number', default: 60 },
      { key: 'maxAgeDays', label: 'Max Age (days, 0 = no limit)', type: 'number', default: 0 },
      { key: 'sortBy', label: 'Sort By (comma-separated: updated, created, author, comments)', type: 'string', default: '' }
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
      },
      'comments': {
        getValue: (item) => item.comments || 0,
        type: 'numeric',
        descending: true
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
      : 'Fetching issues...';
    this.error = null;
    this.updateContent();

    try {
      let token = null;
      if (this.data.authMode === 'ghcli') {
        token = await GitHubAuthHelper.getToken();
        this.loadingStatus = 'Fetching issues...';
        this.updateContent();
      } else if (this.data.authMode === 'pat' && this.data.token) {
        token = this.data.token;
      }

      this.items = await this.fetchIssues(token);
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

  async fetchIssues(accessToken) {
    const owner = encodeURIComponent(this.data.owner);
    const repo = encodeURIComponent(this.data.repo);
    const params = new URLSearchParams({
      state: this.data.state || 'open',
      per_page: String(this.data.maxCount || 25),
      sort: 'updated',
      direction: 'desc'
    });

    if (this.data.labels) {
      params.set('labels', this.data.labels);
    }
    if (this.data.assignee) {
      params.set('assignee', this.data.assignee);
    }
    if (this.data.milestone) {
      params.set('milestone', this.data.milestone);
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/issues?${params}`;

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

    // The issues endpoint also returns pull requests; filter them out
    items = items.filter(item => !item.pull_request);

    // Client-side author filter (GitHub API doesn't support creator param on this endpoint consistently)
    if (this.data.author) {
      const author = this.data.author.toLowerCase();
      items = items.filter(issue => issue.user?.login?.toLowerCase() === author);
    }

    return items;
  }

  // ---------------------------------------------------------------------------
  // Render a single issue item
  // ---------------------------------------------------------------------------

  renderItem(issue) {
    const title = this.escapeHtml(issue.title || '(no title)');
    const author = this.escapeHtml(issue.user?.login || 'Unknown');
    const initials = this.getInitials(issue.user?.login || '?');
    const avatarUrl = issue.user?.avatar_url;
    const age = TimeFormatter.formatRelative(issue.updated_at || issue.created_at);
    const url = issue.html_url || '#';
    const number = issue.number;

    const stateClass = this.getStateClass(issue);
    const stateIcon = this.getStateIcon(issue);
    const labelHtml = this.renderLabels(issue.labels);

    const avatarHtml = avatarUrl
      ? `<img class="ado-widget-avatar" src="${this.escapeHtml(avatarUrl)}" alt="${author}"><span class="ado-widget-avatar-initials" style="display:none">${initials}</span>`
      : `<span class="ado-widget-avatar-initials">${initials}</span>`;

    const commentHtml = issue.comments > 0
      ? `<span class="github-issues-comments" title="${issue.comments} comment${issue.comments !== 1 ? 's' : ''}">💬 ${issue.comments}</span>`
      : '';

    return `
      <li class="ado-widget-item ${stateClass}">
        <a href="${url}" target="_blank" class="ado-widget-link" title="${title}">
          <div class="ado-widget-avatar-container">
            ${avatarHtml}
          </div>
          <div class="github-issues-content">
            <div class="github-issues-line1">
              <span class="github-issues-title">${title}</span>
              <span class="github-issues-state-icon">${stateIcon}</span>
            </div>
            <div class="github-issues-line2">
              <span class="github-issues-number">#${number}</span>
              <span class="github-issues-author">${author}</span>
              ${labelHtml}
              ${commentHtml}
              <span class="github-issues-age">${age}</span>
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
      return `<span class="github-issues-label" style="background:${color}" title="${name}">${name}</span>`;
    }).join('');
  }

  getStateClass(issue) {
    if (issue.state === 'closed') {
      return issue.state_reason === 'not_planned'
        ? 'github-issues-state-not-planned'
        : 'github-issues-state-closed';
    }
    return 'github-issues-state-open';
  }

  getStateIcon(issue) {
    if (issue.state === 'closed') {
      return issue.state_reason === 'not_planned'
        ? '<span title="Closed as not planned">⊘</span>'
        : '<span title="Closed as completed">✔</span>';
    }
    return '<span title="Open">○</span>';
  }
}
