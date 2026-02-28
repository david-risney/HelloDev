import { DataWidgetBase } from './DataWidgetBase.js';
import { DevBoxAuthHelper } from '../DevBoxAuthHelper.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * Microsoft Dev Box Widget
 *
 * Lists available dev boxes for the signed-in user from devbox.microsoft.com.
 * Uses the Dev Center data-plane REST API with a token acquired via az cli.
 *
 * API endpoint: GET https://devboxes.azure.com/devboxes?api-version=2024-10-01-preview
 * Docs: https://learn.microsoft.com/en-us/rest/api/devcenter/developer/dev-boxes
 */
export class DevBoxWidget extends DataWidgetBase {
  static metadata = {
    name: 'Dev Boxes',
    icon: '💻',
    group: 'Azure',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'devbox' });

    // Defaults
    this.data.devCenter ??= '';
    this.data.maxCount ??= 25;
    this.data.refreshInterval ??= 5;
    this.data.title ??= '';
    this.data.projectFilter ??= '';

    this.restoreFromCache();
  }

  // ---------------------------------------------------------------------------
  // DataWidgetBase overrides
  // ---------------------------------------------------------------------------

  get isConfigured() {
    // Works without devCenter (uses global endpoint) or with one (per-dev-center endpoint)
    return true;
  }

  getCachePrefix() { return 'devbox'; }
  getDefaultTitle() { return 'Dev Boxes'; }
  getEmptyMessage() { return 'No dev boxes found'; }
  getConfigureMessage() { return 'Sign in with az login to see your dev boxes'; }

  getItemDateField(item) {
    return item.createdTime || null;
  }

  getTitleUrl() {
    return 'https://devbox.microsoft.com';
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  getConfigSchema() {
    return [
      { key: 'title', label: 'Widget Title (optional)', type: 'string', default: '' },
      { key: 'devCenter', label: 'Dev Center Name (optional, blank = all)', type: 'string', default: '', placeholder: 'mydevcenter' },
      { key: 'projectFilter', label: 'Project Filter (optional, comma-separated)', type: 'string', default: '' },
      { key: 'maxCount', label: 'Max Items to Show', type: 'number', default: 25 },
      { key: 'refreshInterval', label: 'Auto Refresh (minutes, 0 = disabled)', type: 'number', default: 5 }
    ];
  }

  setConfig(values) {
    super.setConfig(values);
    this.items = [];
    this.lastFetched = null;
    this.lastServerFetch = null;
    this.clearCache();
    if (this.element) {
      this.refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch lifecycle
  // ---------------------------------------------------------------------------

  async refresh() {
    if (this.loading) return;

    this.loading = true;
    this.loadingStatus = 'Obtaining access token...';
    this.error = null;
    this.updateContent();

    try {
      const accessToken = await DevBoxAuthHelper.getToken();
      this.loadingStatus = 'Fetching dev boxes...';
      this.updateContent();

      this.items = await this.fetchDevBoxes(accessToken);
      this.lastFetched = Date.now();
      this.lastServerFetch = this.lastFetched;
      this.saveToCache();
    } catch (err) {
      DevBoxAuthHelper.handleAuthError(err.message);
      this.error = this.buildRefreshError(err, 'Microsoft Dev Box');
      this.errorDialogOpen = true;
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  // ---------------------------------------------------------------------------
  // API calls
  // ---------------------------------------------------------------------------

  /**
   * Fetch all dev boxes for the signed-in user.
   * When devCenter is set, uses https://{devCenter}.devcenter.azure.com.
   * Otherwise uses the global aggregation endpoint at https://devboxes.azure.com.
   */
  async fetchDevBoxes(accessToken) {
    const apiVersion = '2025-04-01-preview';
    let url;
    if (this.data.devCenter) {
      const devCenter = encodeURIComponent(this.data.devCenter);
      url = `https://${devCenter}.devcenter.azure.com/devboxes?api-version=${apiVersion}`;
    } else {
      url = `https://devboxes.azure.com/devboxes?api-version=${apiVersion}`;
    }

    const { data, token } = await this.devBoxFetch(url, accessToken);
    let boxes = data.value || [];

    // Apply project filter if configured
    if (this.data.projectFilter) {
      const filters = this.data.projectFilter.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
      if (filters.length > 0) {
        boxes = boxes.filter(box =>
          filters.some(f => (box.projectName || '').toLowerCase().includes(f))
        );
      }
    }

    // Limit to maxCount
    return boxes.slice(0, this.data.maxCount || 25);
  }

  /**
   * Fetch with auth headers and 401 retry (same pattern as ADOWidgetBase.adoFetch).
   */
  async devBoxFetch(url, accessToken, options = {}) {
    const buildHeaders = (token) => ({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    });

    let response = await fetch(url, {
      ...options,
      headers: buildHeaders(accessToken)
    });

    // On 401, clear cache and retry once with a fresh token
    if (response.status === 401) {
      DevBoxAuthHelper.clearCache();
      accessToken = await DevBoxAuthHelper.getToken();
      response = await fetch(url, {
        ...options,
        headers: buildHeaders(accessToken)
      });
    }

    if (!response.ok) {
      let body = '';
      try {
        const json = await response.json();
        body = json.message || json.error?.message || JSON.stringify(json);
      } catch {
        try { body = await response.text(); } catch { /* ignore */ }
      }

      let message;
      switch (response.status) {
        case 401:
          message = 'Authentication failed. Try running: az login';
          break;
        case 403:
          message = 'Access denied. Check your Dev Center permissions.';
          break;
        case 404:
          message = 'Resource not found. The Dev Box API may not be available.';
          break;
        default:
          message = `API error ${response.status}${body ? ': ' + body : ''}`;
      }

      const err = new Error(message);
      err.status = response.status;
      err.details = `HTTP ${response.status} from ${response.url || url}${body ? '\n' + body : ''}`;
      throw err;
    }

    const data = await response.json();
    return { data, token: accessToken };
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  renderItem(item) {
    const name = this.escapeHtml(item.name || 'Unnamed');
    const project = this.escapeHtml(item.projectName || '');
    const pool = this.escapeHtml(item.poolName || '');
    const powerState = item.powerState || 'Unknown';
    const actionState = item.actionState || '';
    const provisioningState = item.provisioningState || '';
    const osType = item.osType || '';
    const location = item.location || '';

    const powerClass = this.getPowerStateClass(powerState);
    const powerLabel = this.getPowerStateLabel(powerState, actionState, provisioningState);
    const powerIcon = this.getPowerStateIcon(powerState, actionState, provisioningState);

    const specs = this.getSpecsSummary(item);
    const age = item.createdTime ? TimeFormatter.formatRelative(item.createdTime) : '';

    // Link to the dev box in the Dev Box portal
    const boxUrl = 'https://devbox.microsoft.com';

    return `
      <li class="ado-widget-item devbox-item ${powerClass}">
        <a href="${boxUrl}" target="_blank" class="ado-widget-link">
          <div class="devbox-icon-container">
            <span class="devbox-power-icon">${powerIcon}</span>
          </div>
          <div class="devbox-item-content">
            <div class="devbox-item-line1">
              <span class="devbox-item-name">${name}</span>
              <span class="devbox-power-badge ${powerClass}">${this.escapeHtml(powerLabel)}</span>
            </div>
            <div class="devbox-item-line2">
              <span class="devbox-item-project">${project}</span>
              ${pool ? `<span class="devbox-item-pool">${pool}</span>` : ''}
              ${specs ? `<span class="devbox-item-specs">${this.escapeHtml(specs)}</span>` : ''}
              ${age ? `<span class="devbox-item-age">${age}</span>` : ''}
            </div>
          </div>
        </a>
      </li>
    `;
  }

  // ---------------------------------------------------------------------------
  // Power state helpers
  // ---------------------------------------------------------------------------

  getPowerStateClass(powerState) {
    const lower = (powerState || '').toLowerCase();
    if (lower === 'running') return 'devbox-running';
    if (lower === 'stopped' || lower === 'deallocated') return 'devbox-stopped';
    if (lower === 'hibernated') return 'devbox-hibernated';
    return 'devbox-unknown';
  }

  getPowerStateLabel(powerState, actionState, provisioningState) {
    // Show action state if a transition is in progress
    const action = (actionState || '').toLowerCase();
    if (action && action !== 'stopped' && action !== 'started') {
      // Capitalize first letter
      return actionState.charAt(0).toUpperCase() + actionState.slice(1);
    }

    const prov = (provisioningState || '').toLowerCase();
    if (prov && prov !== 'succeeded') {
      return provisioningState.charAt(0).toUpperCase() + provisioningState.slice(1);
    }

    const lower = (powerState || '').toLowerCase();
    if (lower === 'running') return 'Running';
    if (lower === 'deallocated' || lower === 'stopped') return 'Stopped';
    if (lower === 'hibernated') return 'Hibernated';
    return powerState || 'Unknown';
  }

  getPowerStateIcon(powerState, actionState, provisioningState) {
    const action = (actionState || '').toLowerCase();
    if (action === 'starting' || action === 'stopping' || action === 'restarting' ||
        action === 'provisioning' || action === 'deleting') {
      return '⏳';
    }

    const lower = (powerState || '').toLowerCase();
    if (lower === 'running') return '🟢';
    if (lower === 'deallocated' || lower === 'stopped') return '⭕';
    if (lower === 'hibernated') return '🟡';
    return '⚪';
  }

  getSpecsSummary(item) {
    const parts = [];
    if (item.hardwareProfile) {
      if (item.hardwareProfile.vCPUs) parts.push(`${item.hardwareProfile.vCPUs} vCPU`);
      if (item.hardwareProfile.memoryGB) parts.push(`${item.hardwareProfile.memoryGB} GB`);
    }
    if (item.storageProfile?.osDisk?.diskSizeGB) {
      parts.push(`${item.storageProfile.osDisk.diskSizeGB} GB disk`);
    }
    return parts.join(' · ');
  }
}
