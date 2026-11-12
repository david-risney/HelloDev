import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { DevDashWidget } from '../../src/widgets/DevDashWidget.js';
import { createWidget } from '../../src/widgets/index.js';
import { DevDashClient } from '../../src/DevDashClient.js';
import { WidgetPacks } from '../../src/widgetPacks.js';

const item = {
  provider: 'ado', kind: 'pr', id: '42', title: 'Improve dashboard', state: 'active',
  url: 'https://example.com/pull/42', author: 'A Developer', assignees: [], labels: [],
  createdAt: '2026-11-01T12:00:00Z', updatedAt: null, draft: true,
  providerData: { mergeStatus: 'succeeded', reviewerVotes: [{ reviewer: 'Reviewer', vote: 0 }] }
};
const snapshot = (items = [item]) => ({
  schemaVersion: 1, profile: 'work', query: 'prs', provider: 'ado', resource: 'prs',
  fetchedAt: '2026-11-12T12:00:00Z', queryUrl: 'https://example.com/pulls',
  items, page: { total: 1, nextCursor: null }, stale: true, fromCache: true
});
const make = data => new DevDashWidget({
  id: 'work-widget', type: 'devdash', data: { profile: 'work', queryName: 'prs', ...data }
});

beforeEach(() => { vi.spyOn(DevDashClient, 'request').mockResolvedValue(snapshot()); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('DevDash widget migration', () => {
  it.each(['adopr', 'adobugs', 'githubpr', 'githubissues', 'gerritcl', 'chromiumbug'])(
    'preserves layout and identity but drops credentials and duplicate provider settings: %s', type => {
      const widget = createWidget({
        id: 'saved', type, x: 2, y: 3, width: 4, height: 5, minimized: true,
        data: { title: 'My queue', token: 'test-secret', gitcookieToken: 'test-cookie', organization: 'old', query: 'old query' }
      });
      expect(widget).toBeInstanceOf(DevDashWidget);
      expect(widget.toJSON()).toMatchObject({ id: 'saved', type, x: 2, y: 3, width: 4, height: 5, minimized: true, data: { title: 'My queue' } });
      expect(widget.toJSON().data).not.toHaveProperty('token');
      expect(widget.toJSON().data).not.toHaveProperty('gitcookieToken');
      expect(widget.toJSON().data).not.toHaveProperty('query');
      expect(widget.getContent()).toContain('now uses DevDash');
      expect(DevDashClient.request).not.toHaveBeenCalled();
    }
  );

  it('creates work packs with references, not duplicate provider queries', () => {
    for (const pack of WidgetPacks.filter(pack => pack.id !== 'starter-dashboard')) {
      const widgets = pack.createWidgets({ profile: 'shared', bugs: 'bugs', prs: 'my-prs', reviews: 'review-prs' });
      expect(widgets.every(widget => widget.data.profile === 'shared' && widget.data.queryName)).toBe(true);
      expect(widgets.every(widget => !('authMode' in widget.data))).toBe(true);
    }
  });
});

describe('DevDash reads and presentation', () => {
  it('reads adaptively on load and leaves freshness with DevDash', async () => {
    const widget = make();
    await widget.refresh();
    expect(DevDashClient.request.mock.calls[0][0]).toMatchObject({
      command: 'get', profile: 'work', query: 'prs', cacheMode: 'adaptive', pageSize: 25
    });
    expect(widget.getContent()).toContain('Improve dashboard');
    expect(widget.getContent()).not.toContain('STALE');
    expect(widget.getContent()).toContain('reviewerVotes');
    expect(widget.getContent()).toContain('Draft');
    expect(widget.getContent()).not.toContain('Approval required');
  });

  it('uses a flat profile without a named query', async () => {
    await make({ queryName: '' }).refresh();
    expect(DevDashClient.request.mock.calls[0][0]).not.toHaveProperty('query');
  });

  it('forces a shared refresh, then reads a bounded cache-only page', async () => {
    DevDashClient.request.mockResolvedValueOnce({
      jobId: 'job-1', backgroundRefresh: { id: 'job-1', state: 'complete' }
    });
    const widget = make();
    await widget.refresh({ force: true });
    expect(DevDashClient.request.mock.calls[0][0]).toEqual({ command: 'refresh-start', profile: 'work', query: 'prs' });
    expect(DevDashClient.request.mock.calls[1][0]).toMatchObject({ command: 'get', cachedOnly: true, pageSize: 25 });
    expect(DevDashClient.request.mock.calls[1][0]).not.toHaveProperty('cacheMode');
  });

  it('tracks only its own detached refresh and does not report failed jobs as success', async () => {
    vi.useFakeTimers();
    DevDashClient.request.mockResolvedValueOnce({
      jobId: 'job-1', backgroundRefresh: { id: 'job-1', state: 'running' }
    }).mockResolvedValueOnce({
      backgroundRefresh: { id: 'job-1', state: 'failed', code: 'AUTH_REQUIRED' }
    });
    const widget = make();
    const refresh = widget.refresh({ force: true });
    await vi.advanceTimersByTimeAsync(1000);
    await refresh;
    expect(DevDashClient.request.mock.calls[1][0].command).toBe('status');
    expect(widget.error.code).toBe('AUTH_REQUIRED');
    expect(widget.result).toBeNull();
  });

  it('shows grouped-profile selection errors instead of pretending there are no results', async () => {
    DevDashClient.request.mockResolvedValue({ schemaVersion: 1, queries: { prs: snapshot() } });
    const widget = make({ queryName: '' });
    await widget.refresh();
    expect(widget.error.message).toContain('Select one');
    expect(widget.getContent()).not.toContain('No items found');
  });

  it('keeps the previous view and reports refresh failures', async () => {
    const widget = make();
    await widget.refresh();
    DevDashClient.request.mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'AUTH_REQUIRED' }));
    await widget.refresh();
    expect(widget.items).toHaveLength(1);
    expect(widget.getContent()).toContain('Permission denied');
    expect(widget.getContent()).toContain('this read failed');
    expect(widget.getContent()).toContain('AUTH_REQUIRED');
  });

  it('surfaces background refresh failures alongside the returned cached snapshot', async () => {
    DevDashClient.request.mockResolvedValue({ ...snapshot(), refreshStatus: 'failed' });
    const widget = make();
    await widget.refresh();
    expect(widget.getContent()).toContain('background refresh failed');
    expect(widget.items).toHaveLength(1);
  });

  it('rejects malformed rows without breaking rendering or hiding the protocol error', async () => {
    DevDashClient.request.mockResolvedValue(snapshot([{ ...item, labels: 'not-an-array' }]));
    const widget = make();
    await widget.refresh();
    expect(widget.error.message).toContain('Unsupported DevDash result');
    expect(widget.getContent()).toContain('Unsupported DevDash result');
  });

  it('pages only through the current snapshot and reports expired cursors', async () => {
    DevDashClient.request.mockResolvedValueOnce({ ...snapshot(), page: { total: 2, nextCursor: 'cursor1' } });
    const widget = make();
    await widget.refresh();
    DevDashClient.request.mockResolvedValueOnce(snapshot([{ ...item, id: '43' }]));
    await widget.refresh({ more: true });
    expect(DevDashClient.request.mock.calls[1][0]).toMatchObject({ cursor: 'cursor1' });
    expect(widget.items.map(item => item.id)).toEqual(['42', '43']);
  });

  it('escapes all provider text and rejects script/credential links', async () => {
    DevDashClient.request.mockResolvedValue(snapshot([{
      ...item, title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)',
      providerData: { metadata: '</code><script>alert(1)</script>' }
    }]));
    const widget = make();
    await widget.refresh();
    const content = document.createElement('div');
    content.innerHTML = widget.getContent();
    expect(content.querySelector('img, script')).toBeNull();
    expect(content.querySelector('[href^="javascript:"]')).toBeNull();
    expect(content.textContent).toContain('<img src=x');
  });

  it('renders a semantic keyboard-scrollable table', async () => {
    const widget = make({ view: 'table' });
    await widget.refresh();
    const content = document.createElement('div');
    content.innerHTML = widget.getContent();
    expect(content.querySelector('[role="region"][tabindex="0"] table')).not.toBeNull();
    expect(content.querySelectorAll('th[scope="col"]')).toHaveLength(4);
    expect(content.querySelector('th[scope="row"] a').textContent).toBe('#42');
  });

  it('rejects invalid page sizes without contacting DevDash', async () => {
    const widget = make({ pageSize: 201 });
    await widget.refresh();
    expect(widget.error.message).toContain('1 to 200');
    expect(DevDashClient.request).not.toHaveBeenCalled();
  });

  it('ignores a response for an old configuration', async () => {
    let resolve;
    DevDashClient.request.mockReturnValue(new Promise(done => { resolve = done; }));
    const widget = make();
    const read = widget.refresh();
    widget.setConfig({ profile: 'different' });
    resolve(snapshot());
    await read;
    expect(widget.items).toEqual([]);
    expect(widget.result).toBeNull();
    expect(widget.loading).toBe(false);
  });

  it('cleans up intervals, pending reads and base widget observers', async () => {
    vi.useFakeTimers();
    const widget = make();
    const element = document.createElement('div');
    widget.element = element;
    widget._setupObserver = { disconnect: vi.fn() };
    const observer = widget._setupObserver;
    widget.setupBehavior(element);
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);
    widget.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });
});
