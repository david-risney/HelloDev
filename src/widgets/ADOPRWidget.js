import { WidgetBase } from './WidgetBase.js';
import { ADOAuthHelper } from '../ADOAuthHelper.js';

/**
 * Azure DevOps Pull Request widget - displays a list of PRs
 * Uses native messaging with az cli for authentication
 */
export class ADOPRWidget extends WidgetBase {
  static metadata = {
    name: 'ADO PRs',
    icon: '🔀',
    defaultSize: { width: 4, height: 4 }
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
    this.data.creatorEmail ??= '';
    this.data.reviewerEmail ??= '';
    this.data.targetBranch ??= '';
    this.data.titleText ??= '';
    this.data.title ??= '';
    
    // Cache for resolved user IDs
    this._userIdCache = {};
    
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
      },
      {
        key: 'creatorEmail',
        label: 'Creator Email (optional)',
        type: 'string',
        default: ''
      },
      {
        key: 'reviewerEmail',
        label: 'Reviewer Email (optional)',
        type: 'string',
        default: ''
      },
      {
        key: 'targetBranch',
        label: 'Target Branch (optional, e.g. main)',
        type: 'string',
        default: ''
      },
      {
        key: 'titleText',
        label: 'Title Contains (optional)',
        type: 'string',
        default: ''
      },
      {
        key: 'title',
        label: 'Widget Title (optional)',
        type: 'string',
        default: ''
      }
    ];
  }

  /**
   * Override setConfig to clear cache and refresh when config changes.
   */
  setConfig(values) {
    super.setConfig(values);
    
    // Clear cached data
    this.prs = [];
    this.lastFetched = null;
    this.lastServerFetch = null;
    localStorage.removeItem(this.getCacheKey());
    
    // Refresh if configured
    if (this.isConfigured && this.element) {
      this.fetchPRs();
    }
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

    const displayTitle = this.escapeHtml(this.data.title || 'Pull Requests');
    const titleHtml = this.data.repository
      ? `<a href="${this.getPRListUrl()}" target="_blank" class="widget-adopr-title-link">${displayTitle}</a>`
      : `<span class="widget-adopr-title">${displayTitle}</span>`;

    return `
      <div class="widget-adopr-header">
        ${titleHtml}
        <span class="widget-adopr-last-updated" title="Last updated">${lastFetchedStr}</span>
        <button class="widget-adopr-refresh" title="Reload">⟳</button>
      </div>
      <ul class="widget-adopr-list">
        ${this.prs.map(pr => this.renderPR(pr)).join('')}
      </ul>
    `;
  }

  getPRListUrl() {
    const org = encodeURIComponent(this.data.organization);
    const project = encodeURIComponent(this.data.project);
    return `https://dev.azure.com/${org}/${project}/_git/${encodeURIComponent(this.data.repository)}/pullrequests`;
  }

  renderPR(pr) {
    const statusClass = this.getStatusClass(pr.status);
    const reviewerStatus = this.getReviewerStatusIcon(pr);
    const age = this.formatAge(pr.creationDate);
    const creator = this.escapeHtml(pr.createdBy?.displayName || 'Unknown');
    const avatarUrl = pr.createdBy?.imageUrl;
    const initials = this.getInitials(pr.createdBy?.displayName || '?');
    
    const avatarHtml = avatarUrl
      ? `<img class="widget-adopr-avatar" src="${this.escapeHtml(avatarUrl)}" alt="${creator}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="widget-adopr-avatar-initials" style="display:none">${initials}</span>`
      : `<span class="widget-adopr-avatar-initials">${initials}</span>`;
    
    return `
      <li class="widget-adopr-item ${statusClass}">
        <a href="${pr.url}" target="_blank" class="widget-adopr-link">
          <div class="widget-adopr-avatar-container">
            ${avatarHtml}
          </div>
          <div class="widget-adopr-pr-content">
            <div class="widget-adopr-pr-line1">
              <span class="widget-adopr-pr-title">${this.escapeHtml(pr.title)}</span>
              <span class="widget-adopr-pr-status">${reviewerStatus}</span>
            </div>
            <div class="widget-adopr-pr-line2">
              <span class="widget-adopr-pr-id">#${pr.pullRequestId}</span>
              <span class="widget-adopr-pr-author">${creator}</span>
              <span class="widget-adopr-pr-age">${age}</span>
            </div>
          </div>
        </a>
      </li>
    `;
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
    if (!dateString) return '';
    
    const created = new Date(dateString);
    const now = new Date();
    const diffMs = now - created;
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
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
  
  buildApiUrl(creatorId, reviewerId) {
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
    
    // Add creator filter
    if (creatorId) {
      url += `&searchCriteria.creatorId=${encodeURIComponent(creatorId)}`;
    }
    
    // Add reviewer filter
    if (reviewerId) {
      url += `&searchCriteria.reviewerId=${encodeURIComponent(reviewerId)}`;
    }
    
    // Add target branch filter
    if (this.data.targetBranch) {
      const branchRef = this.data.targetBranch.startsWith('refs/') 
        ? this.data.targetBranch 
        : `refs/heads/${this.data.targetBranch}`;
      url += `&searchCriteria.targetRefName=${encodeURIComponent(branchRef)}`;
    }
    
    // Add title text filter
    if (this.data.titleText) {
      url += `&searchCriteria.title=${encodeURIComponent(this.data.titleText)}`;
    }
    
    return url;
  }

  /**
   * Look up a user's GUID by email or display name
   */
  async resolveUserId(emailOrName, accessToken) {
    if (!emailOrName) return null;
    
    // Check cache first
    if (this._userIdCache[emailOrName]) {
      return this._userIdCache[emailOrName];
    }
    
    const org = encodeURIComponent(this.data.organization);
    
    // Use the Graph API to search for users
    // The subjectQuery parameter searches across display name and email
    const url = `https://vssps.dev.azure.com/${org}/_apis/graph/users?api-version=7.0-preview.1&subjectTypes=aad,msa&$top=10`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`[ADOPRWidget] Failed to search users: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      const users = data.value || [];
      
      // Find user by email (principalName) or display name
      const searchLower = emailOrName.toLowerCase();
      const user = users.find(u => 
        u.principalName?.toLowerCase() === searchLower ||
        u.displayName?.toLowerCase() === searchLower ||
        u.mailAddress?.toLowerCase() === searchLower
      );
      
      if (user) {
        // Extract the user ID from the descriptor or use originId
        // The descriptor format is typically: aad.{base64-encoded-id}
        const userId = user.originId || user.descriptor;
        this._userIdCache[emailOrName] = userId;
        return userId;
      }
      
      // If exact match not found, try a more specific search using identities API
      return await this.resolveUserIdViaIdentities(emailOrName, accessToken);
    } catch (err) {
      console.warn(`[ADOPRWidget] Error resolving user '${emailOrName}':`, err);
      return null;
    }
  }

  /**
   * Fallback user lookup using the identities API
   */
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
      console.warn(`[ADOPRWidget] Error in identity lookup:`, err);
      return null;
    }
  }

  async fetchPRs() {
    if (this.loading || !this.isConfigured) return;

    this.loading = true;
    this.loadingStatus = 'Obtaining access token...';
    this.error = null;
    this.updateContent();

    try {
      const accessToken = await ADOAuthHelper.getToken();

      // Resolve user IDs if email filters are configured
      let creatorId = null;
      let reviewerId = null;
      
      if (this.data.creatorEmail) {
        this.loadingStatus = 'Looking up creator...';
        this.updateContent();
        creatorId = await this.resolveUserId(this.data.creatorEmail, accessToken);
        if (!creatorId) {
          console.warn(`[ADOPRWidget] Could not resolve creator: ${this.data.creatorEmail}`);
        }
      }
      
      if (this.data.reviewerEmail) {
        this.loadingStatus = 'Looking up reviewer...';
        this.updateContent();
        reviewerId = await this.resolveUserId(this.data.reviewerEmail, accessToken);
        if (!reviewerId) {
          console.warn(`[ADOPRWidget] Could not resolve reviewer: ${this.data.reviewerEmail}`);
        }
      }

      this.loadingStatus = 'Fetching pull requests...';
      this.updateContent();

      const response = await fetch(this.buildApiUrl(creatorId, reviewerId), {
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
