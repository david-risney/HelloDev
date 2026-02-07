import { WidgetBase } from './WidgetBase.js';
import { ADOAuthHelper } from '../ADOAuthHelper.js';

/**
 * Azure DevOps Pull Request widget - displays a list of PRs
 * Uses native messaging with az cli for authentication
 */
export class ADOPRWidget extends WidgetBase {
  static metadata = {
    name: 'ADO PRs',
    icon: '🔀'
  };

  constructor(config) {
    super({ ...config, type: 'adopr' });
    this.prs = [];
    this.loading = false;
    this.loadingStatus = '';       // Current loading sub-activity
    this.error = null;
    this.lastFetched = null;      // Timestamp for display (includes cache restore)
    this.lastServerFetch = null;  // Timestamp of actual server fetch (for auto-refresh)
    this.intervalId = null;
    
    // Apply defaults
    this.data.organization ??= '';
    this.data.project ??= '';
    this.data.repository ??= '';
    this.data.status ??= 'active';
    this.data.maxCount ??= 10;
    this.data.refreshInterval ??= 60;
    
    this.restoreFromCache();
  }
  
  get isConfigured() {
    return this.data.organization && this.data.project;
  }
  
  getCacheKey() {
    return `adopr_cache_${this.id}`;
  }
  
  restoreFromCache() {
    try {
      const cached = localStorage.getItem(this.getCacheKey());
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data.prs)) {
          this.prs = data.prs;
          this.lastFetched = data.lastFetched || null;
        }
      }
    } catch (e) {
      console.error('[ADOPRWidget] Cache restore error:', e);
    }
  }
  
  saveToCache() {
    try {
      localStorage.setItem(this.getCacheKey(), JSON.stringify({
        prs: this.prs,
        lastFetched: this.lastFetched
      }));
    } catch (e) {
      console.error('[ADOPRWidget] Cache save error:', e);
    }
  }

  getConfigSchema() {
    return [
      {
        key: 'organization',
        label: 'Organization',
        type: 'string',
        default: ''
      },
      {
        key: 'project',
        label: 'Project',
        type: 'string',
        default: ''
      },
      {
        key: 'repository',
        label: 'Repository (optional)',
        type: 'string',
        default: ''
      },
      {
        key: 'status',
        label: 'PR Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
          { value: 'abandoned', label: 'Abandoned' },
          { value: 'all', label: 'All' }
        ],
        default: 'active'
      },
      {
        key: 'maxCount',
        label: 'Max PRs to Show',
        type: 'number',
        default: 10
      },
      {
        key: 'refreshInterval',
        label: 'Auto Refresh (minutes, 0 = disabled)',
        type: 'number',
        default: 60
      }
    ];
  }

  getContent() {
    if (!this.isConfigured) {
      return `
        <div class="widget-adopr-empty">
          <div class="widget-adopr-icon">🔧</div>
          <p>Configure organization and project to see PRs</p>
        </div>
      `;
    }

    if (this.loading) {
      return `
        <div class="widget-adopr-loading">
          <div class="widget-adopr-spinner">⟳</div>
          <p>${this.loadingStatus || 'Loading...'}</p>
        </div>
      `;
    }

    if (this.error) {
      return `
        <div class="widget-adopr-error">
          <div class="widget-adopr-icon">⚠️</div>
          <p>${this.error}</p>
          <button class="widget-adopr-retry">Retry</button>
        </div>
      `;
    }

    if (this.prs.length === 0) {
      return `
        <div class="widget-adopr-empty">
          <div class="widget-adopr-icon">✓</div>
          <p>No pull requests found</p>
          <button class="widget-adopr-refresh" title="Reload">⟳</button>
        </div>
      `;
    }

    const lastFetchedStr = this.lastFetched 
      ? new Date(this.lastFetched).toLocaleTimeString()
      : '';

    return `
      <div class="widget-adopr-header">
        <span class="widget-adopr-title">Pull Requests</span>
        <span class="widget-adopr-last-updated" title="Last updated">${lastFetchedStr}</span>
        <button class="widget-adopr-refresh" title="Reload">⟳</button>
      </div>
      <ul class="widget-adopr-list">
        ${this.prs.map(pr => this.renderPR(pr)).join('')}
      </ul>
    `;
  }

  renderPR(pr) {
    const statusClass = this.getStatusClass(pr.status);
    const reviewerStatus = this.getReviewerStatusIcon(pr);
    
    return `
      <li class="widget-adopr-item ${statusClass}">
        <a href="${pr.url}" target="_blank" class="widget-adopr-link">
          <div class="widget-adopr-pr-header">
            <span class="widget-adopr-pr-id">#${pr.pullRequestId}</span>
            <span class="widget-adopr-pr-status">${reviewerStatus}</span>
          </div>
          <div class="widget-adopr-pr-title">${this.escapeHtml(pr.title)}</div>
          <div class="widget-adopr-pr-meta">
            <span class="widget-adopr-pr-author">${this.escapeHtml(pr.createdBy?.displayName || 'Unknown')}</span>
            <span class="widget-adopr-pr-repo">${this.escapeHtml(pr.repository?.name || '')}</span>
          </div>
        </a>
      </li>
    `;
  }

  getStatusClass(status) {
    const classes = {
      active: 'status-active',
      completed: 'status-completed',
      abandoned: 'status-abandoned'
    };
    return classes[status] || '';
  }

  getReviewerStatusIcon(pr) {
    if (pr.reviewers && pr.reviewers.length > 0) {
      const hasApproval = pr.reviewers.some(r => r.vote > 0);
      const hasRejection = pr.reviewers.some(r => r.vote < 0);
      
      if (hasRejection) return '❌';
      if (hasApproval) return '✓';
      return '⏳';
    }
    return '👁';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setupBehavior(element) {
    element.addEventListener('click', (e) => {
      if (e.target.classList.contains('widget-adopr-refresh') || 
          e.target.classList.contains('widget-adopr-retry')) {
        e.preventDefault();
        e.stopPropagation();
        this.fetchPRs();
      }
    });

    if (this.isConfigured) {
      if (!this.lastFetched) {
        this.fetchPRs();
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
        this.fetchPRs();
      }
    }, 60000);
  }
  
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  buildApiUrl() {
    const org = encodeURIComponent(this.data.organization);
    const project = encodeURIComponent(this.data.project);
    
    let url = this.data.repository
      ? `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${encodeURIComponent(this.data.repository)}/pullrequests`
      : `https://dev.azure.com/${org}/${project}/_apis/git/pullrequests`;
    
    url += '?api-version=7.0';
    if (this.data.status && this.data.status !== 'all') {
      url += `&searchCriteria.status=${this.data.status}`;
    }
    url += `&$top=${this.data.maxCount || 10}`;
    
    return url;
  }

  async fetchPRs() {
    if (this.loading || !this.isConfigured) return;

    this.loading = true;
    this.loadingStatus = 'Obtaining access token...';
    this.error = null;
    this.updateContent();

    try {
      const accessToken = await ADOAuthHelper.getToken();

      this.loadingStatus = 'Fetching pull requests...';
      this.updateContent();

      const response = await fetch(this.buildApiUrl(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Authentication failed. Try running: az login');
        if (response.status === 404) throw new Error('Project or repository not found.');
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      this.prs = (data.value || []).map(pr => ({
        ...pr,
        url: `https://dev.azure.com/${this.data.organization}/${this.data.project}/_git/${pr.repository?.name || ''}/pullrequest/${pr.pullRequestId}`
      }));
      
      this.lastFetched = Date.now();
      this.lastServerFetch = this.lastFetched;
      this.saveToCache();
    } catch (err) {
      this.error = err.message || 'Failed to fetch PRs';
      ADOAuthHelper.handleAuthError(this.error);
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  updateContent() {
    if (this.element) {
      const contentEl = this.element.querySelector('.widget-content');
      if (contentEl) {
        contentEl.innerHTML = this.getContent();
      }
    }
  }
}
