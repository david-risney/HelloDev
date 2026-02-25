import { ADOWidgetBase } from './ADOWidgetBase.js';

/**
 * Azure DevOps Bug / Work Item Query widget.
 * Supports two query modes:
 *  1. Saved Query ID — executes an existing ADO query
 *  2. Field-based filters — builds a WIQL query from config fields
 */
export class ADOBugsWidget extends ADOWidgetBase {
  static metadata = {
    name: 'ADO Bugs',
    icon: '🐛',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'adobugs' });
  }

  applyDefaults() {
    this.data.queryId ??= '';
    this.data.workItemType ??= 'Bug';
    this.data.state ??= '';
    this.data.areaPath ??= '';
    this.data.assignedTo ??= '';
    this.data.severity ??= '';
  }

  getCachePrefix() { return 'adobugs'; }
  getDefaultTitle() { return 'Bug Query'; }
  getEmptyMessage() { return 'No work items found'; }
  getConfigureMessage() { return 'Configure organization and project to see work items'; }

  getItemDateField(item) {
    return item.createdDate;
  }

  get isConfigured() {
    if (!this.data.organization || !this.data.project) return false;
    return !!(this.data.queryId || this.data.workItemType);
  }

  getTitleUrl() {
    const org = encodeURIComponent(this.data.organization);
    const project = encodeURIComponent(this.data.project);
    if (this.data.queryId) {
      return `https://dev.azure.com/${org}/${project}/_queries/query/${encodeURIComponent(this.data.queryId)}`;
    }
    return `https://dev.azure.com/${org}/${project}/_queries`;
  }

  getItemSpecificConfigSchema() {
    return [
      { key: 'queryId', label: 'Saved Query ID (optional)', type: 'string', default: '' },
      { key: 'workItemType', label: 'Work Item Type', type: 'string', default: 'Bug' },
      { key: 'state', label: 'State Filter (optional, e.g. Active)', type: 'string', default: '' },
      { key: 'areaPath', label: 'Area Path (optional)', type: 'string', default: '' },
      { key: 'assignedTo', label: 'Assigned To (optional, email)', type: 'string', default: '' },
      { key: 'severity', label: 'Severity (optional, e.g. 1 - Critical)', type: 'string', default: '' }
    ];
  }

  async fetchItems(accessToken) {
    const org = encodeURIComponent(this.data.organization);
    const project = encodeURIComponent(this.data.project);
    let token = accessToken;
    let workItemIds;

    if (this.data.queryId) {
      // Path 1: Execute saved query
      this.loadingStatus = 'Executing saved query...';
      this.updateContent();

      const queryUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/wiql/${encodeURIComponent(this.data.queryId)}?api-version=7.0`;
      const { data: queryData, token: t1 } = await this.adoFetch(queryUrl, token);
      token = t1;
      workItemIds = (queryData.workItems || []).map(wi => wi.id);
    } else {
      // Path 2: Build WIQL from filters
      this.loadingStatus = 'Querying work items...';
      this.updateContent();

      const wiql = this.buildWiql();
      const wiqlUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0&$top=${this.data.maxCount || 10}`;
      const { data: wiqlData, token: t2 } = await this.adoFetch(wiqlUrl, token, {
        method: 'POST',
        body: JSON.stringify({ query: wiql })
      });
      token = t2;
      workItemIds = (wiqlData.workItems || []).map(wi => wi.id);
    }

    if (workItemIds.length === 0) {
      return [];
    }

    // Limit to maxCount
    const idsToFetch = workItemIds.slice(0, this.data.maxCount || 10);

    // Batch fetch work item details
    this.loadingStatus = `Fetching ${idsToFetch.length} work item(s)...`;
    this.updateContent();

    const batchUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/workitemsbatch?api-version=7.0`;
    const { data: batchData, token: t3 } = await this.adoFetch(batchUrl, token, {
      method: 'POST',
      body: JSON.stringify({
        ids: idsToFetch,
        fields: [
          'System.Id',
          'System.Title',
          'System.State',
          'System.AssignedTo',
          'System.CreatedDate',
          'System.ChangedDate',
          'System.WorkItemType',
          'Microsoft.VSTS.Common.Severity'
        ]
      })
    });

    const items = (batchData.value || []).map(wi => ({
      id: wi.id,
      title: wi.fields['System.Title'],
      state: wi.fields['System.State'],
      assignedTo: wi.fields['System.AssignedTo'],
      createdDate: wi.fields['System.CreatedDate'],
      changedDate: wi.fields['System.ChangedDate'],
      workItemType: wi.fields['System.WorkItemType'],
      severity: wi.fields['Microsoft.VSTS.Common.Severity'],
      url: `https://dev.azure.com/${this.data.organization}/${this.data.project}/_workitems/edit/${wi.id}`
    }));

    await this.resolveIdentityAvatars(items.map(i => i.assignedTo).filter(Boolean), t3);

    return items;
  }

  buildWiql() {
    const conditions = ['[System.TeamProject] = @project'];

    if (this.data.workItemType) {
      conditions.push(`[System.WorkItemType] = '${this.escapeWiql(this.data.workItemType)}'`);
    }
    if (this.data.state) {
      conditions.push(`[System.State] = '${this.escapeWiql(this.data.state)}'`);
    }
    if (this.data.areaPath) {
      conditions.push(`[System.AreaPath] UNDER '${this.escapeWiql(this.data.areaPath)}'`);
    }
    if (this.data.assignedTo) {
      conditions.push(`[System.AssignedTo] = '${this.escapeWiql(this.data.assignedTo)}'`);
    }
    if (this.data.severity) {
      conditions.push(`[Microsoft.VSTS.Common.Severity] = '${this.escapeWiql(this.data.severity)}'`);
    }

    return `SELECT [System.Id] FROM WorkItems WHERE ${conditions.join(' AND ')} ORDER BY [System.CreatedDate] DESC`;
  }

  escapeWiql(value) {
    return value.replace(/'/g, "''");
  }

  renderItem(item) {
    const stateClass = this.getStateClass(item.state);
    const age = this.formatAge(item.createdDate);
    const assignee = this.escapeHtml(item.assignedTo?.displayName || 'Unassigned');
    const avatarUrl = item.assignedTo?.imageUrl;
    const initials = this.getInitials(item.assignedTo?.displayName || '?');
    const severityHtml = item.severity
      ? `<span class="widget-adobugs-severity ${this.getSeverityClass(item.severity)}">${this.escapeHtml(item.severity)}</span>`
      : '';

    const avatarHtml = avatarUrl
      ? `<img class="ado-widget-avatar" src="${this.escapeHtml(avatarUrl)}" alt="${assignee}"><span class="ado-widget-avatar-initials" style="display:none">${initials}</span>`
      : `<span class="ado-widget-avatar-initials">${initials}</span>`;

    return `
      <li class="ado-widget-item ${stateClass}">
        <a href="${item.url}" target="_blank" class="ado-widget-link">
          <div class="ado-widget-avatar-container">
            ${avatarHtml}
          </div>
          <div class="widget-adobugs-item-content">
            <div class="widget-adobugs-item-line1">
              <span class="widget-adobugs-item-title">${this.escapeHtml(item.title)}</span>
              ${severityHtml}
            </div>
            <div class="widget-adobugs-item-line2">
              <span class="widget-adobugs-item-id">${item.id}</span>
              <span class="widget-adobugs-item-state">${this.escapeHtml(item.state || '')}</span>
              <span class="widget-adobugs-item-assigned">${assignee}</span>
              <span class="widget-adobugs-item-age">${age}</span>
            </div>
          </div>
        </a>
      </li>
    `;
  }

  getStateClass(state) {
    if (!state) return '';
    const lower = state.toLowerCase();
    if (lower === 'active' || lower === 'new') return 'state-active';
    if (lower === 'resolved') return 'state-resolved';
    if (lower === 'closed') return 'state-closed';
    return '';
  }

  getSeverityClass(severity) {
    if (!severity) return '';
    if (severity.startsWith('1')) return 'severity-critical';
    if (severity.startsWith('2')) return 'severity-high';
    if (severity.startsWith('3')) return 'severity-medium';
    if (severity.startsWith('4')) return 'severity-low';
    return '';
  }
}
