import { DataWidgetBase } from './DataWidgetBase.js';
import { ADOAuthHelper } from '../ADOAuthHelper.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * Abstract base class for Azure DevOps widgets.
 * Extends DataWidgetBase with ADO-specific auth, API helpers, and user resolution.
 *
 * Subclasses must implement:
 *   - applyDefaults()           — set subclass-specific this.data defaults
 *   - getCachePrefix()          — e.g. 'adopr' or 'adobugs'
 *   - fetchItems(accessToken)   — fetch and return items array
 *   - renderItem(item)          — render a single item as HTML
 *   - getItemSpecificConfigSchema() — additional config fields
 */
export class ADOWidgetBase extends DataWidgetBase {
  static metadata = {
    name: 'ADO Widget',
    icon: '🔷',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super(config);
    this._userIdCache = {};

    // Common ADO defaults
    this.data.organization ??= '';
    this.data.project ??= '';
    this.data.maxCount ??= 10;
    this.data.refreshInterval ??= 60;
    this.data.title ??= '';
    this.data.maxAgeDays ??= 0;

    this.applyDefaults();
    this.restoreFromCache();
  }

  // ---------------------------------------------------------------------------
  // Abstract methods — subclasses MUST implement these
  // ---------------------------------------------------------------------------

  applyDefaults() {}
  getItemSpecificConfigSchema() { return []; }

  async fetchItems(accessToken) { throw new Error('Subclasses must implement fetchItems()'); }

  // ---------------------------------------------------------------------------
  // DataWidgetBase overrides
  // ---------------------------------------------------------------------------

  getDefaultTitle() { return 'Items'; }
  getEmptyMessage() { return 'No items found'; }
  getConfigureMessage() { return 'Configure organization and project'; }

  getItemDateField(item) {
    return item.creationDate || item.createdDate || null;
  }

  get isConfigured() {
    return !!(this.data.organization && this.data.project);
  }

  onContentUpdated(contentEl) {
    contentEl.querySelectorAll('.ado-widget-avatar').forEach(img => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        img.nextElementSibling.style.display = 'flex';
      });
    });
  }

  restoreFromCache() {
    try {
      const cached = localStorage.getItem(this.getCacheKey());
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data.items)) {
          this.items = data.items;
        } else if (Array.isArray(data.prs)) {
          // Migration: old ADOPRWidget cache format
          this.items = data.prs;
        }
        this.lastFetched = data.lastFetched || null;
      }
    } catch (e) {
      console.error(`[${this.constructor.name}] Cache restore error:`, e);
    }
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  getConfigSchema() {
    return [
      { key: 'organization', label: 'Organization', type: 'string', default: '' },
      { key: 'project', label: 'Project', type: 'string', default: '' },
      ...this.getItemSpecificConfigSchema(),
      { key: 'maxCount', label: 'Max Items to Show', type: 'number', default: 10 },
      { key: 'refreshInterval', label: 'Auto Refresh (minutes, 0 = disabled)', type: 'number', default: 60 },
      { key: 'title', label: 'Widget Title (optional)', type: 'string', default: '' },
      { key: 'maxAgeDays', label: 'Max Age in Days (0 = no limit)', type: 'number', default: 0 }
    ];
  }

  setConfig(values) {
    super.setConfig(values);
    this.items = [];
    this.lastFetched = null;
    this.lastServerFetch = null;
    this.clearCache();
    if (this.isConfigured && this.element) {
      this.refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch lifecycle
  // ---------------------------------------------------------------------------

  async refresh() {
    if (this.loading || !this.isConfigured) return;

    this.loading = true;
    this.loadingStatus = 'Obtaining access token...';
    this.error = null;
    this.updateContent();

    try {
      const accessToken = await ADOAuthHelper.getToken();
      this.items = await this.fetchItems(accessToken);
      this.lastFetched = Date.now();
      this.lastServerFetch = this.lastFetched;
      this.saveToCache();
    } catch (err) {
      this.error = this.buildRefreshError(err, 'Azure DevOps');
      this.errorDialogOpen = true;
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  // ---------------------------------------------------------------------------
  // ADO API fetch with auth headers and 401 retry
  // ---------------------------------------------------------------------------

  async adoFetch(url, accessToken, options = {}) {
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
      ADOAuthHelper.clearCache();
      accessToken = await ADOAuthHelper.getToken();
      response = await fetch(url, {
        ...options,
        headers: buildHeaders(accessToken)
      });
    }

    if (!response.ok) {
      let body = '';
      try {
        const json = await response.json();
        body = json.message || json.errorMessage || JSON.stringify(json);
      } catch {
        try { body = await response.text(); } catch { /* ignore */ }
      }

      let message;
      switch (response.status) {
        case 401:
          message = 'Authentication failed. Try running: az login';
          break;
        case 403:
          message = 'Access denied. Check your permissions.';
          break;
        case 404:
          message = 'Resource not found. Check organization, project, and query settings.';
          break;
        case 400:
          message = `Bad request: ${body || 'Check your filter settings.'}`;
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
  // ADO-specific utilities
  // ---------------------------------------------------------------------------

  async fetchAvatarAsDataUrl(imageUrl, accessToken) {
    try {
      const resp = await fetch(imageUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!resp.ok) return null;
      const blob = await resp.blob();
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

  async resolveIdentityAvatars(identities, accessToken) {
    const urlMap = new Map();
    for (const id of identities) {
      if (!id?.imageUrl || id.imageUrl.startsWith('data:')) continue;
      if (!urlMap.has(id.imageUrl)) urlMap.set(id.imageUrl, []);
      urlMap.get(id.imageUrl).push(id);
    }
    await Promise.all([...urlMap.entries()].map(async ([url, ids]) => {
      const dataUrl = await this.fetchAvatarAsDataUrl(url, accessToken);
      if (dataUrl) {
        for (const id of ids) id.imageUrl = dataUrl;
      } else {
        for (const id of ids) id.imageUrl = null;
      }
    }));
  }

  formatAge(dateString) {
    return TimeFormatter.formatRelative(dateString);
  }

  // ---------------------------------------------------------------------------
  // ADO user resolution
  // ---------------------------------------------------------------------------

  async resolveUserId(emailOrName, accessToken) {
    if (!emailOrName) return null;

    if (this._userIdCache[emailOrName]) {
      return this._userIdCache[emailOrName];
    }

    const org = encodeURIComponent(this.data.organization);
    const url = `https://vssps.dev.azure.com/${org}/_apis/graph/users?api-version=7.0-preview.1&subjectTypes=aad,msa&$top=10`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[${this.constructor.name}] Failed to search users: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const users = data.value || [];
      const searchLower = emailOrName.toLowerCase();
      const user = users.find(u =>
        u.principalName?.toLowerCase() === searchLower ||
        u.displayName?.toLowerCase() === searchLower ||
        u.mailAddress?.toLowerCase() === searchLower
      );

      if (user) {
        const userId = user.originId || user.descriptor;
        this._userIdCache[emailOrName] = userId;
        return userId;
      }

      return await this.resolveUserIdViaIdentities(emailOrName, accessToken);
    } catch (err) {
      console.warn(`[${this.constructor.name}] Error resolving user '${emailOrName}':`, err);
      return null;
    }
  }

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
      console.warn(`[${this.constructor.name}] Error in identity lookup:`, err);
      return null;
    }
  }
}
