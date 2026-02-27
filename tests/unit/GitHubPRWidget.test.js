import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubPRWidget } from '../../src/widgets/GitHubPRWidget.js';

describe('GitHubPRWidget', () => {
  describe('metadata', () => {
    it('has correct static metadata', () => {
      expect(GitHubPRWidget.metadata.name).toBe('GitHub PRs');
      expect(GitHubPRWidget.metadata.icon).toBe('🐙');
      expect(GitHubPRWidget.metadata.defaultSize).toEqual({ width: 4, height: 4 });
    });
  });

  describe('constructor', () => {
    it('sets type to githubpr', () => {
      const widget = new GitHubPRWidget({ id: 'gh-1', data: {} });
      expect(widget.type).toBe('githubpr');
    });

    it('applies default values', () => {
      const widget = new GitHubPRWidget({ id: 'gh-2', data: {} });
      expect(widget.data.owner).toBe('');
      expect(widget.data.repo).toBe('');
      expect(widget.data.authMode).toBe('none');
      expect(widget.data.token).toBe('');
      expect(widget.data.state).toBe('open');
      expect(widget.data.baseBranch).toBe('');
      expect(widget.data.author).toBe('');
      expect(widget.data.labels).toBe('');
      expect(widget.data.maxCount).toBe(25);
      expect(widget.data.refreshInterval).toBe(60);
      expect(widget.data.title).toBe('');
      expect(widget.data.maxAgeDays).toBe(0);
    });

    it('preserves provided config values', () => {
      const widget = new GitHubPRWidget({
        id: 'gh-3',
        data: { owner: 'octocat', repo: 'hello-world', state: 'closed' }
      });
      expect(widget.data.owner).toBe('octocat');
      expect(widget.data.repo).toBe('hello-world');
      expect(widget.data.state).toBe('closed');
    });
  });

  describe('isConfigured', () => {
    it('returns false when owner and repo are empty', () => {
      const widget = new GitHubPRWidget({ id: 'gh-4', data: {} });
      expect(widget.isConfigured).toBe(false);
    });

    it('returns false when only owner is set', () => {
      const widget = new GitHubPRWidget({ id: 'gh-5', data: { owner: 'octocat' } });
      expect(widget.isConfigured).toBe(false);
    });

    it('returns false when only repo is set', () => {
      const widget = new GitHubPRWidget({ id: 'gh-6', data: { repo: 'hello-world' } });
      expect(widget.isConfigured).toBe(false);
    });

    it('returns true when both owner and repo are set', () => {
      const widget = new GitHubPRWidget({
        id: 'gh-7', data: { owner: 'octocat', repo: 'hello-world' }
      });
      expect(widget.isConfigured).toBe(true);
    });
  });

  describe('getCachePrefix', () => {
    it('returns githubpr', () => {
      const widget = new GitHubPRWidget({ id: 'gh-8', data: {} });
      expect(widget.getCachePrefix()).toBe('githubpr');
    });
  });

  describe('getDefaultTitle', () => {
    it('returns GitHub PRs', () => {
      const widget = new GitHubPRWidget({ id: 'gh-9', data: {} });
      expect(widget.getDefaultTitle()).toBe('GitHub PRs');
    });
  });

  describe('getTitleUrl', () => {
    it('returns null when not configured', () => {
      const widget = new GitHubPRWidget({ id: 'gh-10', data: {} });
      expect(widget.getTitleUrl()).toBeNull();
    });

    it('returns the correct GitHub pulls URL', () => {
      const widget = new GitHubPRWidget({
        id: 'gh-11', data: { owner: 'octocat', repo: 'hello-world' }
      });
      expect(widget.getTitleUrl()).toBe('https://github.com/octocat/hello-world/pulls');
    });

    it('encodes special characters in owner and repo', () => {
      const widget = new GitHubPRWidget({
        id: 'gh-12', data: { owner: 'my org', repo: 'my repo' }
      });
      expect(widget.getTitleUrl()).toBe('https://github.com/my%20org/my%20repo/pulls');
    });
  });

  describe('getItemDateField', () => {
    it('returns updated_at when available', () => {
      const widget = new GitHubPRWidget({ id: 'gh-13', data: {} });
      const item = { updated_at: '2026-02-25T10:00:00Z', created_at: '2026-02-20T10:00:00Z' };
      expect(widget.getItemDateField(item)).toBe('2026-02-25T10:00:00Z');
    });

    it('falls back to created_at', () => {
      const widget = new GitHubPRWidget({ id: 'gh-14', data: {} });
      const item = { created_at: '2026-02-20T10:00:00Z' };
      expect(widget.getItemDateField(item)).toBe('2026-02-20T10:00:00Z');
    });
  });

  describe('getConfigSchema', () => {
    it('returns the expected config fields', () => {
      const widget = new GitHubPRWidget({ id: 'gh-15', data: {} });
      const schema = widget.getConfigSchema();
      const keys = schema.map(f => f.key);
      expect(keys).toContain('owner');
      expect(keys).toContain('repo');
      expect(keys).toContain('authMode');
      expect(keys).toContain('token');
      expect(keys).toContain('state');
      expect(keys).toContain('baseBranch');
      expect(keys).toContain('author');
      expect(keys).toContain('labels');
      expect(keys).toContain('maxCount');
      expect(keys).toContain('refreshInterval');
      expect(keys).toContain('maxAgeDays');
    });

    it('state field has open/closed/all options', () => {
      const widget = new GitHubPRWidget({ id: 'gh-16', data: {} });
      const stateField = widget.getConfigSchema().find(f => f.key === 'state');
      expect(stateField.type).toBe('select');
      expect(stateField.options.map(o => o.value)).toEqual(['open', 'closed', 'all']);
    });

    it('authMode field has none/pat/ghcli options', () => {
      const widget = new GitHubPRWidget({ id: 'gh-16b', data: {} });
      const authField = widget.getConfigSchema().find(f => f.key === 'authMode');
      expect(authField.type).toBe('select');
      expect(authField.options.map(o => o.value)).toEqual(['none', 'pat', 'ghcli']);
    });
  });

  describe('getStateClass', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubPRWidget({ id: 'gh-17', data: {} });
    });

    it('returns draft class for draft PRs', () => {
      expect(widget.getStateClass({ draft: true, state: 'open' })).toBe('github-pr-state-draft');
    });

    it('returns merged class for closed PRs with merged_at', () => {
      expect(widget.getStateClass({ draft: false, state: 'closed', merged_at: '2026-01-01' }))
        .toBe('github-pr-state-merged');
    });

    it('returns closed class for closed PRs without merged_at', () => {
      expect(widget.getStateClass({ draft: false, state: 'closed' }))
        .toBe('github-pr-state-closed');
    });

    it('returns open class for open non-draft PRs', () => {
      expect(widget.getStateClass({ draft: false, state: 'open' }))
        .toBe('github-pr-state-open');
    });
  });

  describe('getReviewStatusIcon', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubPRWidget({ id: 'gh-18', data: {} });
    });

    it('returns pending icon when reviewers are requested', () => {
      const pr = { requested_reviewers: [{ login: 'reviewer1' }] };
      expect(widget.getReviewStatusIcon(pr)).toContain('⏳');
    });

    it('returns draft icon for draft PRs', () => {
      const pr = { draft: true, requested_reviewers: [] };
      expect(widget.getReviewStatusIcon(pr)).toContain('📝');
    });

    it('returns open icon for normal PRs', () => {
      const pr = { draft: false, requested_reviewers: [] };
      expect(widget.getReviewStatusIcon(pr)).toContain('👁');
    });
  });

  describe('renderLabels', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubPRWidget({ id: 'gh-19', data: {} });
    });

    it('returns empty string when no labels', () => {
      expect(widget.renderLabels([])).toBe('');
      expect(widget.renderLabels(null)).toBe('');
      expect(widget.renderLabels(undefined)).toBe('');
    });

    it('renders labels with correct color', () => {
      const labels = [{ name: 'bug', color: 'd73a4a' }];
      const html = widget.renderLabels(labels);
      expect(html).toContain('bug');
      expect(html).toContain('#d73a4a');
      expect(html).toContain('github-pr-label');
    });

    it('limits to 3 labels', () => {
      const labels = [
        { name: 'a', color: '111111' },
        { name: 'b', color: '222222' },
        { name: 'c', color: '333333' },
        { name: 'd', color: '444444' }
      ];
      const html = widget.renderLabels(labels);
      expect(html).toContain('a');
      expect(html).toContain('b');
      expect(html).toContain('c');
      expect(html).not.toContain('>d<');
    });
  });

  describe('renderItem', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubPRWidget({ id: 'gh-20', data: {} });
    });

    it('renders a basic PR item', () => {
      const pr = {
        title: 'Fix the bug',
        number: 42,
        html_url: 'https://github.com/octocat/repo/pull/42',
        state: 'open',
        draft: false,
        user: { login: 'octocat', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
        updated_at: '2026-02-25T10:00:00Z',
        created_at: '2026-02-20T10:00:00Z',
        requested_reviewers: [],
        labels: []
      };
      const html = widget.renderItem(pr);
      expect(html).toContain('Fix the bug');
      expect(html).toContain('#42');
      expect(html).toContain('octocat');
      expect(html).toContain('https://github.com/octocat/repo/pull/42');
      expect(html).toContain('github-pr-state-open');
    });

    it('renders draft badge for draft PRs', () => {
      const pr = {
        title: 'WIP feature',
        number: 7,
        html_url: '#',
        state: 'open',
        draft: true,
        user: { login: 'dev' },
        updated_at: '2026-02-25T10:00:00Z',
        requested_reviewers: [],
        labels: []
      };
      const html = widget.renderItem(pr);
      expect(html).toContain('github-pr-draft');
      expect(html).toContain('Draft');
    });

    it('renders avatar image when available', () => {
      const pr = {
        title: 'PR', number: 1, html_url: '#', state: 'open', draft: false,
        user: { login: 'user', avatar_url: 'https://example.com/avatar.png' },
        updated_at: '2026-02-25T10:00:00Z',
        requested_reviewers: [], labels: []
      };
      const html = widget.renderItem(pr);
      expect(html).toContain('ado-widget-avatar');
      expect(html).toContain('https://example.com/avatar.png');
    });

    it('renders initials when no avatar URL', () => {
      const pr = {
        title: 'PR', number: 1, html_url: '#', state: 'open', draft: false,
        user: { login: 'alice' },
        updated_at: '2026-02-25T10:00:00Z',
        requested_reviewers: [], labels: []
      };
      const html = widget.renderItem(pr);
      expect(html).toContain('ado-widget-avatar-initials');
      expect(html).toContain('AL');
    });
  });

  describe('fetchPullRequests', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubPRWidget({
        id: 'gh-21', data: { owner: 'octocat', repo: 'hello-world' }
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls the correct GitHub API URL', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await widget.fetchPullRequests(null);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('https://api.github.com/repos/octocat/hello-world/pulls');
      expect(url).toContain('state=open');
      expect(url).toContain('per_page=25');
      expect(options.headers).toHaveProperty('Accept', 'application/vnd.github+json');
    });

    it('includes auth header when token is passed', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await widget.fetchPullRequests('ghp_test123');

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.headers.Authorization).toBe('Bearer ghp_test123');
    });

    it('does not include auth header when token is null', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await widget.fetchPullRequests(null);

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('includes base branch parameter when set', async () => {
      widget.data.baseBranch = 'main';
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await widget.fetchPullRequests(null);

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('base=main');
    });

    it('filters by author on the client side', async () => {
      widget.data.author = 'Octocat';
      const prs = [
        { number: 1, user: { login: 'octocat' } },
        { number: 2, user: { login: 'other' } }
      ];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(prs)
      });

      const result = await widget.fetchPullRequests(null);
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
    });

    it('filters by labels on the client side', async () => {
      widget.data.labels = 'bug, enhancement';
      const prs = [
        { number: 1, labels: [{ name: 'bug' }, { name: 'enhancement' }] },
        { number: 2, labels: [{ name: 'bug' }] },
        { number: 3, labels: [] }
      ];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(prs)
      });

      const result = await widget.fetchPullRequests(null);
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
    });

    it('throws on 404 with descriptive message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ message: 'Not Found' }),
        url: 'https://api.github.com/repos/octocat/hello-world/pulls'
      });

      await expect(widget.fetchPullRequests(null)).rejects.toThrow('Repository not found');
    });

    it('throws on 401 with auth message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'Bad credentials' }),
        url: 'https://api.github.com/repos/octocat/hello-world/pulls'
      });

      await expect(widget.fetchPullRequests('token123')).rejects.toThrow('Authentication failed');
    });

    it('throws on 401 with gh cli message when authMode is ghcli', async () => {
      widget.data.authMode = 'ghcli';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'Bad credentials' }),
        url: 'https://api.github.com/repos/octocat/hello-world/pulls'
      });

      await expect(widget.fetchPullRequests('token123')).rejects.toThrow('gh auth login');
    });

    it('throws on 403 rate limit with helpful message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ message: 'API rate limit exceeded' }),
        url: 'https://api.github.com/repos/octocat/hello-world/pulls'
      });

      await expect(widget.fetchPullRequests(null)).rejects.toThrow('rate limit');
    });
  });

  describe('refresh with auth modes', () => {
    let widget;

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('uses PAT token when authMode is pat', async () => {
      widget = new GitHubPRWidget({
        id: 'gh-auth-1',
        data: { owner: 'octocat', repo: 'hello-world', authMode: 'pat', token: 'ghp_mytoken' }
      });
      widget.element = document.createElement('div');
      widget.element.innerHTML = '<div class="widget-content"></div>';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([])
      });

      await widget.refresh();

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.headers.Authorization).toBe('Bearer ghp_mytoken');
    });

    it('makes unauthenticated request when authMode is none', async () => {
      widget = new GitHubPRWidget({
        id: 'gh-auth-2',
        data: { owner: 'octocat', repo: 'hello-world', authMode: 'none' }
      });
      widget.element = document.createElement('div');
      widget.element.innerHTML = '<div class="widget-content"></div>';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([])
      });

      await widget.refresh();

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });
  });

  describe('refresh', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubPRWidget({
        id: 'gh-22', data: { owner: 'octocat', repo: 'hello-world' }
      });
      widget.element = document.createElement('div');
      widget.element.innerHTML = '<div class="widget-content"></div>';
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('does not refresh when not configured', async () => {
      widget.data.owner = '';
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      await widget.refresh();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not refresh when already loading', async () => {
      widget.loading = true;
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      await widget.refresh();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sets items and lastFetched on success', async () => {
      const prs = [{ number: 1, title: 'Test PR' }];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(prs)
      });

      await widget.refresh();

      expect(widget.items).toEqual(prs);
      expect(widget.lastFetched).toBeGreaterThan(0);
      expect(widget.loading).toBe(false);
      expect(widget.error).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      await widget.refresh();

      expect(widget.error).not.toBeNull();
      expect(widget.errorDialogOpen).toBe(true);
      expect(widget.loading).toBe(false);
    });
  });
});
