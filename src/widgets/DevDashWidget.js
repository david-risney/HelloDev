import { WidgetBase } from './WidgetBase.js';
import { DevDashClient, validateDevDashRequest } from '../DevDashClient.js';
import { safeHtml, rawHtml } from '../htmlUtils.js';
import { TimeFormatter } from '../TimeFormatter.js';

const DISPLAY_KEYS = ['profile', 'queryName', 'title', 'refreshInterval', 'pageSize', 'view', 'sortBy'];
const RESULT_FIELDS = [
  'title', 'state', 'repository', 'author', 'assignees', 'labels', 'createdAt',
  'updatedAt', 'draft', 'priority', 'severity', 'type', 'identities', 'providerData'
];

export function safeDevDashUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function validateResult(result) {
  if (result?.queries) throw new Error('This profile contains named queries. Select one in Configure.');
  if (result?.schemaVersion !== 1 || !Array.isArray(result.items) ||
      !result.items.every(item => item && typeof item.id === 'string' &&
        typeof item.title === 'string' && typeof item.state === 'string' &&
        typeof item.provider === 'string' && typeof item.url === 'string' &&
        ['bug', 'pr', 'cl'].includes(item.kind) &&
        ['assignees', 'labels'].every(key => Array.isArray(item[key]) &&
          item[key].every(value => typeof value === 'string')) &&
        typeof item.providerData === 'object' && item.providerData !== null &&
        !Array.isArray(item.providerData))) {
    throw new Error('Unsupported DevDash result. Update DevDash and refresh the query.');
  }
  return result;
}

export class DevDashWidget extends WidgetBase {
  static metadata = {
    name: 'DevDash Query', icon: '\u{1F4CB}', group: 'DevDash',
    defaultSize: { width: 5, height: 4 }
  };

  constructor(config) {
    super({ ...config, data: { ...config.data } });
    // Provider-specific queries and credentials are deliberately not copied or synced.
    this.needsMigration = config.type !== 'devdash' && !this.data.profile;
    this.data = Object.fromEntries(DISPLAY_KEYS.filter(key => this.data[key] !== undefined)
      .map(key => [key, this.data[key]]));
    this.data.profile ??= '';
    this.data.queryName ??= '';
    this.data.title ??= '';
    this.data.refreshInterval ??= 5;
    this.data.pageSize ??= 25;
    this.data.view ??= 'cards';
    this.data.sortBy ??= 'updated';
    this.items = [];
    this.result = null;
    this.error = null;
    this.loading = false;
    this.generation = 0;
  }

  get isConfigured() { return Boolean(this.data.profile); }

  getConfigSchema() {
    return [
      { key: 'title', label: 'Widget title (optional)', type: 'string', default: '' },
      { key: 'profile', label: 'DevDash profile', type: 'string', default: '' },
      { key: 'queryName', label: 'Named query (empty for a flat profile)', type: 'string', default: '' },
      { key: 'view', label: 'Display', type: 'select', options: ['cards', 'table'], default: 'cards' },
      { key: 'sortBy', label: 'Sort loaded items', type: 'select', options: ['updated', 'created', 'title', 'state'], default: 'updated' },
      { key: 'pageSize', label: 'Items per page (1-200)', type: 'number', default: 25 },
      { key: 'refreshInterval', label: 'Read interval (minutes, 0 = page load and manual only)', type: 'number', default: 5 }
    ];
  }

  setConfig(values) {
    this.stop();
    super.setConfig(values);
    this.items = [];
    this.result = null;
    this.error = null;
    this.needsMigration = false;
    // The configuration dialog re-renders the dashboard after saving.
    this.updateContent();
  }

  buildRequest({ force = false, more = false } = {}) {
    const pageSize = Number(this.data.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      throw new Error('Items per page must be an integer from 1 to 200');
    }
    if (!Number.isFinite(this.data.refreshInterval) || this.data.refreshInterval < 0) {
      throw new Error('Read interval must be zero or a positive number of minutes');
    }
    const request = { command: force ? 'refresh-start' : 'get', profile: this.data.profile.trim() };
    if (this.data.queryName.trim()) request.query = this.data.queryName.trim();
    if (!force) {
      request.pageSize = pageSize;
      request.fields = RESULT_FIELDS;
      if (more) request.cursor = this.result.page.nextCursor;
      else request.cacheMode = 'adaptive';
    }
    validateDevDashRequest(request);
    return request;
  }

  async waitForRefresh(request, signal) {
    const started = await DevDashClient.request(request, { signal });
    if (!started.jobId) throw new Error('DevDash did not return a refresh job ID');
    let job = started.backgroundRefresh;
    const deadline = Date.now() + 180_000;
    while (true) {
      signal.throwIfAborted();
      if (job?.id !== started.jobId) throw new Error('The shared refresh changed. Read the query again.');
      if (job.state === 'complete') return;
      if (job.state !== 'running') {
        const error = new Error(`DevDash refresh ${job.state}. Check devdash logs tail --errors.`);
        error.code = job.code;
        throw error;
      }
      if (Date.now() >= deadline) {
        throw new Error('DevDash is still refreshing in the background. Read again later.');
      }
      await new Promise(resolve => {
        const done = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', done);
          resolve();
        };
        const timer = setTimeout(done, 1000);
        signal.addEventListener('abort', done, { once: true });
      });
      signal.throwIfAborted();
      job = (await DevDashClient.request({ ...request, command: 'status' }, { signal })).backgroundRefresh;
    }
  }

  async refresh(options = {}) {
    if (this.loading || !this.isConfigured) return;
    const generation = this.generation;
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.loading = true;
    this.error = null;
    this.updateContent();
    try {
      const request = this.buildRequest(options);
      if (options.force) {
        // Refresh jobs avoid returning an unbounded snapshot over native messaging.
        await this.waitForRefresh(request, signal);
      }
      const readRequest = options.force ? this.buildRequest() : request;
      if (options.force) {
        delete readRequest.cacheMode;
        readRequest.cachedOnly = true;
      }
      const result = validateResult(await DevDashClient.request(
        readRequest, { signal }
      ));
      if (generation !== this.generation) return;
      this.items = options.more ? [...this.items, ...result.items] : result.items;
      this.result = result;
      if (['failed', 'interrupted'].includes(result.refreshStatus)) {
        this.error = new Error(`DevDash background refresh ${result.refreshStatus}. Check devdash logs tail --errors.`);
      }
    } catch (error) {
      if (generation !== this.generation || error.name === 'AbortError') return;
      this.error = error;
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.updateContent();
      }
    }
  }

  sortedItems() {
    const key = this.data.sortBy;
    return [...this.items].sort((a, b) => {
      if (key === 'title' || key === 'state') return (a[key] || '').localeCompare(b[key] || '');
      const field = key === 'created' ? 'createdAt' : 'updatedAt';
      return (Date.parse(b[field] || b.createdAt) || 0) - (Date.parse(a[field] || a.createdAt) || 0);
    });
  }

  itemLink(item) {
    const url = safeDevDashUrl(item.url);
    const label = `${item.kind === 'cl' ? 'CL ' : '#'}${item.id}`;
    return url ? safeHtml`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : safeHtml`<span>${label}</span>`;
  }

  renderItems() {
    const items = this.sortedItems();
    if (!items.length) return '<p class="devdash-empty">No items found.</p>';
    if (this.data.view === 'table') {
      return safeHtml`<div class="devdash-table-scroll" tabindex="0" role="region" aria-label="Query results">
        <table><thead><tr><th scope="col">Item</th><th scope="col">Title</th><th scope="col">State</th><th scope="col">Person</th></tr></thead>
        <tbody>${rawHtml(items.map(item => safeHtml`<tr>
          <th scope="row">${rawHtml(this.itemLink(item))}</th>
          <td>${item.title}${item.draft ? ' (Draft)' : ''}</td><td>${item.state}</td>
          <td>${item.kind === 'bug' ? (item.assignees || []).join(', ') : item.author}</td>
        </tr>`).join(''))}</tbody></table></div>`;
    }
    return `<ul class="devdash-items">${items.map(item => {
      const person = item.kind === 'bug' ? (item.assignees || []).join(', ') : item.author;
      return safeHtml`<li class="devdash-item">
        <div class="devdash-item-heading">${rawHtml(this.itemLink(item))}<strong>${item.title}</strong></div>
        <div class="devdash-item-meta"><span>${item.state}</span>${item.draft ? rawHtml('<span>Draft</span>') : ''}
          <span>${person}</span><span>${item.repository}</span>
          <span>${[item.priority, item.severity].filter(Boolean).join(' / ')}</span>
        </div>
        <details><summary>Details</summary><dl>
          <dt>Provider</dt><dd>${item.provider}</dd>
          <dt>Labels</dt><dd>${(item.labels || []).join(', ')}</dd>
          <dt>Updated</dt><dd>${item.updatedAt || 'Not supplied'}</dd>
        </dl><pre tabindex="0"><code>${JSON.stringify(item.providerData, null, 2)}</code></pre></details>
      </li>`;
    }).join('')}</ul>`;
  }

  getContent() {
    const title = this.data.title || this.constructor.metadata.name;
    if (!this.isConfigured) {
      return safeHtml`<section class="devdash-widget"><h2>${title}</h2>
        <p>${this.needsMigration ? 'This widget now uses DevDash. Its position and title were preserved.' : 'Use a shared DevDash query for bugs, PRs or CLs.'}</p>
        <p>Select a profile and named query in Configure. Provider filters and sign-in live in DevDash, not this layout.</p>
        <a href="#action=setup">Set up DevDash</a></section>`;
    }
    const queryUrl = safeDevDashUrl(this.result?.queryUrl);
    const heading = queryUrl
      ? safeHtml`<a href="${queryUrl}" target="_blank" rel="noopener noreferrer">${title}</a>`
      : safeHtml`${title}`;
    const age = this.result?.fetchedAt ? TimeFormatter.formatRelative(this.result.fetchedAt) : '';
    return safeHtml`<section class="devdash-widget" aria-busy="${this.loading}">
      <header class="devdash-header"><h2>${rawHtml(heading)}</h2>
        <button type="button" data-devdash-action="read" ${rawHtml(this.loading ? 'disabled' : '')}>Read</button>
        <button type="button" data-devdash-action="refresh" ${rawHtml(this.loading ? 'disabled' : '')}>Refresh shared query</button>
      </header>
      <p class="devdash-status" role="status">${this.loading ? 'Reading DevDash...' : [this.data.profile, this.data.queryName, age].filter(Boolean).join(' / ')}</p>
      ${this.error ? rawHtml(safeHtml`<div class="devdash-error" role="alert">
        <strong>${this.error.message}</strong>
        <p>${[this.error.code, this.error.diagnosticId].filter(Boolean).join(' / ')}</p>
        <p>${this.items.length ? 'The last rendered results remain below; this read failed.' : 'Check DevDash setup and query configuration, then retry.'}</p>
        <a href="#action=setup">DevDash setup</a>
        <button type="button" data-devdash-action="read">Retry</button>
      </div>`) : ''}
      ${this.result ? rawHtml(this.renderItems()) : ''}
      ${this.result?.truncated ? rawHtml('<p class="devdash-warning">Provider result limit reached. This is not the complete query.</p>') : ''}
      ${this.result?.page ? rawHtml(safeHtml`<p class="devdash-status">${this.items.length} of ${this.result.page.total} cached matches loaded</p>`) : ''}
      ${this.result?.page?.nextCursor ? rawHtml(safeHtml`<button type="button" data-devdash-action="more" ${rawHtml(this.loading ? 'disabled' : '')}>Load more</button>`) : ''}
    </section>`;
  }

  updateContent() {
    const content = this.element?.querySelector('.widget-content');
    if (content) content.innerHTML = this.getContent();
  }

  setupBehavior(element) {
    this.clickHandler = event => {
      const button = event.target.closest('[data-devdash-action]');
      if (!button) return;
      event.stopPropagation();
      const action = button.dataset.devdashAction;
      void this.refresh({ force: action === 'refresh', more: action === 'more' });
    };
    element.addEventListener('click', this.clickHandler);
    void this.refresh();
    if (Number.isFinite(this.data.refreshInterval) && this.data.refreshInterval > 0) {
      this.interval = setInterval(() => {
        if (!document.hidden) void this.refresh();
      }, Math.max(60_000, this.data.refreshInterval * 60_000));
    }
  }

  stop() {
    this.generation++;
    this.controller?.abort();
    this.loading = false;
    clearInterval(this.interval);
  }

  destroy() {
    this.stop();
    if (this.clickHandler) this.element?.removeEventListener('click', this.clickHandler);
    super.destroy();
  }
}
