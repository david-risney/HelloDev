import { ADOWidgetBase } from './ADOWidgetBase.js';

/**
 * Azure DevOps Pull Request widget - displays a list of PRs.
 * Uses native messaging with az cli for authentication.
 */
export class ADOPRWidget extends ADOWidgetBase {
  static metadata = {
    name: 'ADO PRs',
    icon: '🔀',
    group: 'ADO',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'adopr' });
  }

  applyDefaults() {
    this.data.repository ??= '';
    this.data.status ??= 'active';
    this.data.creatorEmail ??= '';
    this.data.reviewerEmail ??= '';
    this.data.targetBranch ??= '';
    this.data.titleText ??= '';
    this.data.sortBy ??= '';
  }

  getCachePrefix() { return 'adopr'; }
  getDefaultTitle() { return 'Pull Requests'; }
  getEmptyMessage() { return 'No pull requests found'; }
  getConfigureMessage() { return 'Configure organization and project to see PRs'; }

  getItemDateField(item) {
    return item.creationDate;
  }

  getTitleUrl() {
    if (!this.data.organization || !this.data.project) return null;
    const org = encodeURIComponent(this.data.organization);
    const project = encodeURIComponent(this.data.project);
    if (this.data.repository) {
      return `https://dev.azure.com/${org}/${project}/_git/${encodeURIComponent(this.data.repository)}/pullrequests`;
    }
    return `https://dev.azure.com/${org}/${project}/`;
  }

  getItemSpecificConfigSchema() {
    return [
      { key: 'repository', label: 'Repository (optional)', type: 'string', default: '' },
      {
        key: 'status', label: 'PR Status', type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
          { value: 'abandoned', label: 'Abandoned' },
          { value: 'all', label: 'All' }
        ],
        default: 'active'
      },
      { key: 'creatorEmail', label: 'Creator (email, name, or ID — comma-separated, optional)', type: 'string', default: '' },
      { key: 'reviewerEmail', label: 'Reviewer (email, name, or ID — comma-separated, optional)', type: 'string', default: '' },
      { key: 'targetBranch', label: 'Target Branch (optional, e.g. main)', type: 'string', default: '' },
      { key: 'titleText', label: 'Title Contains (optional)', type: 'string', default: '' },
      { key: 'sortBy', label: 'Sort By (comma-separated: creation date, creator)', type: 'string', default: '' }
    ];
  }

  getSortableColumns() {
    return {
      'creation date': {
        getValue: (item) => item.creationDate,
        type: 'date'
      },
      'creator': {
        getValue: (item) => item.createdBy?.displayName || '',
        type: 'string'
      }
    };
  }

  getDefaultSortColumn() { return 'creation date'; }

  parseEmailList(value) {
    if (!value) return [];
    return value.split(',').map(e => e.trim()).filter(Boolean);
  }

  async fetchItems(accessToken) {
    let token = accessToken;

    const creatorEmails = this.parseEmailList(this.data.creatorEmail);
    const reviewerEmails = this.parseEmailList(this.data.reviewerEmail);

    // Resolve all creator and reviewer emails to user IDs
    const creatorIds = [];
    for (const email of creatorEmails) {
      this.loadingStatus = `Looking up creator: ${email}...`;
      this.updateContent();
      const id = await this.resolveUserId(email, token);
      if (!id) throw new Error(`Could not resolve creator: ${email}`);
      creatorIds.push(id);
    }

    const reviewerIds = [];
    for (const email of reviewerEmails) {
      this.loadingStatus = `Looking up reviewer: ${email}...`;
      this.updateContent();
      const id = await this.resolveUserId(email, token);
      if (!id) throw new Error(`Could not resolve reviewer: ${email}`);
      reviewerIds.push(id);
    }

    this.loadingStatus = 'Fetching pull requests...';
    this.updateContent();

    // Build all (creator, reviewer) combinations and fetch each
    const creators = creatorIds.length > 0 ? creatorIds : [null];
    const reviewers = reviewerIds.length > 0 ? reviewerIds : [null];

    const seen = new Set();
    const allItems = [];
    let currentToken = token;

    for (const cId of creators) {
      for (const rId of reviewers) {
        const { data, token: t } = await this.adoFetch(
          this.buildApiUrl(cId, rId),
          currentToken
        );
        currentToken = t;
        for (const pr of (data.value || [])) {
          if (!seen.has(pr.pullRequestId)) {
            seen.add(pr.pullRequestId);
            allItems.push({
              ...pr,
              url: `https://dev.azure.com/${this.data.organization}/${this.data.project}/_git/${pr.repository?.name || ''}/pullrequest/${pr.pullRequestId}`
            });
          }
        }
      }
    }

    await this.resolveIdentityAvatars(allItems.map(i => i.createdBy).filter(Boolean), currentToken);

    return allItems;
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

    if (creatorId) {
      url += `&searchCriteria.creatorId=${encodeURIComponent(creatorId)}`;
    }
    if (reviewerId) {
      url += `&searchCriteria.reviewerId=${encodeURIComponent(reviewerId)}`;
    }
    if (this.data.targetBranch) {
      const branchRef = this.data.targetBranch.startsWith('refs/')
        ? this.data.targetBranch
        : `refs/heads/${this.data.targetBranch}`;
      url += `&searchCriteria.targetRefName=${encodeURIComponent(branchRef)}`;
    }
    if (this.data.titleText) {
      url += `&searchCriteria.title=${encodeURIComponent(this.data.titleText)}`;
    }

    return url;
  }

  renderItem(pr) {
    const statusClass = this.getStatusClass(pr.status);
    const reviewerStatus = this.getReviewerStatusIcon(pr);
    const age = this.formatAge(pr.creationDate);
    const creator = this.escapeHtml(pr.createdBy?.displayName || 'Unknown');
    const avatarUrl = pr.createdBy?.imageUrl;
    const initials = this.getInitials(pr.createdBy?.displayName || '?');

    const avatarHtml = avatarUrl
      ? `<img class="ado-widget-avatar" src="${this.escapeHtml(avatarUrl)}" alt="${creator}"><span class="ado-widget-avatar-initials" style="display:none">${initials}</span>`
      : `<span class="ado-widget-avatar-initials">${initials}</span>`;

    return `
      <li class="ado-widget-item ${statusClass}">
        <a href="${pr.url}" target="_blank" class="ado-widget-link" title="${this.escapeHtml(pr.title)}">
          <div class="ado-widget-avatar-container">
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
}
