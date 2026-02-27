import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubIssuesWidget } from '../../src/widgets/GitHubIssuesWidget.js';

describe('GitHubIssuesWidget', () => {
  describe('metadata', () => {
    it('has correct static metadata', () => {
      expect(GitHubIssuesWidget.metadata.name).toBe('GitHub Issues');
      expect(GitHubIssuesWidget.metadata.icon).toBe('🐛');
      expect(GitHubIssuesWidget.metadata.defaultSize).toEqual({ width: 4, height: 4 });
    });
  });

  describe('constructor', () => {
    it('sets type to githubissues', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-1', data: {} });
      expect(widget.type).toBe('githubissues');
    });

    it('applies default values', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-2', data: {} });
      expect(widget.data.owner).toBe('');
      expect(widget.data.repo).toBe('');
      expect(widget.data.authMode).toBe('none');
      expect(widget.data.token).toBe('');
      expect(widget.data.state).toBe('open');
      expect(widget.data.author).toBe('');
      expect(widget.data.labels).toBe('');
      expect(widget.data.assignee).toBe('');
      expect(widget.data.milestone).toBe('');
      expect(widget.data.maxCount).toBe(25);
      expect(widget.data.refreshInterval).toBe(60);
      expect(widget.data.title).toBe('');
      expect(widget.data.maxAgeDays).toBe(0);
    });

    it('preserves provided config values', () => {
      const widget = new GitHubIssuesWidget({
        id: 'gi-3',
        data: { owner: 'octocat', repo: 'hello-world', state: 'closed' }
      });
      expect(widget.data.owner).toBe('octocat');
      expect(widget.data.repo).toBe('hello-world');
      expect(widget.data.state).toBe('closed');
    });
  });

  describe('isConfigured', () => {
    it('returns false when owner and repo are empty', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-4', data: {} });
      expect(widget.isConfigured).toBe(false);
    });

    it('returns false when only owner is set', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-5', data: { owner: 'octocat' } });
      expect(widget.isConfigured).toBe(false);
    });

    it('returns false when only repo is set', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-6', data: { repo: 'hello-world' } });
      expect(widget.isConfigured).toBe(false);
    });

    it('returns true when both owner and repo are set', () => {
      const widget = new GitHubIssuesWidget({
        id: 'gi-7', data: { owner: 'octocat', repo: 'hello-world' }
      });
      expect(widget.isConfigured).toBe(true);
    });
  });

  describe('getCachePrefix', () => {
    it('returns githubissues', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-8', data: {} });
      expect(widget.getCachePrefix()).toBe('githubissues');
    });
  });

  describe('getDefaultTitle', () => {
    it('returns GitHub Issues', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-9', data: {} });
      expect(widget.getDefaultTitle()).toBe('GitHub Issues');
    });
  });

  describe('getTitleUrl', () => {
    it('returns null when not configured', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-10', data: {} });
      expect(widget.getTitleUrl()).toBeNull();
    });

    it('returns the correct GitHub issues URL', () => {
      const widget = new GitHubIssuesWidget({
        id: 'gi-11', data: { owner: 'octocat', repo: 'hello-world' }
      });
      expect(widget.getTitleUrl()).toBe('https://github.com/octocat/hello-world/issues');
    });

    it('encodes special characters in owner and repo', () => {
      const widget = new GitHubIssuesWidget({
        id: 'gi-12', data: { owner: 'my org', repo: 'my repo' }
      });
      expect(widget.getTitleUrl()).toBe('https://github.com/my%20org/my%20repo/issues');
    });
  });

  describe('getItemDateField', () => {
    it('returns updated_at when available', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-13', data: {} });
      const item = { updated_at: '2026-02-25T10:00:00Z', created_at: '2026-02-20T10:00:00Z' };
      expect(widget.getItemDateField(item)).toBe('2026-02-25T10:00:00Z');
    });

    it('falls back to created_at', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-14', data: {} });
      const item = { created_at: '2026-02-20T10:00:00Z' };
      expect(widget.getItemDateField(item)).toBe('2026-02-20T10:00:00Z');
    });
  });

  describe('getConfigSchema', () => {
    it('returns the expected config fields', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-15', data: {} });
      const schema = widget.getConfigSchema();
      const keys = schema.map(f => f.key);
      expect(keys).toContain('owner');
      expect(keys).toContain('repo');
      expect(keys).toContain('authMode');
      expect(keys).toContain('token');
      expect(keys).toContain('state');
      expect(keys).toContain('author');
      expect(keys).toContain('labels');
      expect(keys).toContain('assignee');
      expect(keys).toContain('milestone');
      expect(keys).toContain('maxCount');
      expect(keys).toContain('refreshInterval');
      expect(keys).toContain('maxAgeDays');
    });

    it('state field has open/closed/all options', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-16', data: {} });
      const stateField = widget.getConfigSchema().find(f => f.key === 'state');
      expect(stateField.type).toBe('select');
      expect(stateField.options.map(o => o.value)).toEqual(['open', 'closed', 'all']);
    });

    it('authMode field has none/pat/ghcli options', () => {
      const widget = new GitHubIssuesWidget({ id: 'gi-16b', data: {} });
      const authField = widget.getConfigSchema().find(f => f.key === 'authMode');
      expect(authField.type).toBe('select');
      expect(authField.options.map(o => o.value)).toEqual(['none', 'pat', 'ghcli']);
    });
  });

  describe('getStateClass', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubIssuesWidget({ id: 'gi-17', data: {} });
    });

    it('returns closed class for closed issues completed', () => {
      expect(widget.getStateClass({ state: 'closed', state_reason: 'completed' }))
        .toBe('github-issues-state-closed');
    });

    it('returns not-planned class for closed issues not planned', () => {
      expect(widget.getStateClass({ state: 'closed', state_reason: 'not_planned' }))
        .toBe('github-issues-state-not-planned');
    });

    it('returns open class for open issues', () => {
      expect(widget.getStateClass({ state: 'open' }))
        .toBe('github-issues-state-open');
    });
  });

  describe('getStateIcon', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubIssuesWidget({ id: 'gi-18', data: {} });
    });

    it('returns completed icon for closed completed issues', () => {
      const issue = { state: 'closed', state_reason: 'completed' };
      expect(widget.getStateIcon(issue)).toContain('✔');
    });

    it('returns not-planned icon for closed not_planned issues', () => {
      const issue = { state: 'closed', state_reason: 'not_planned' };
      expect(widget.getStateIcon(issue)).toContain('⊘');
    });

    it('returns open icon for open issues', () => {
      const issue = { state: 'open' };
      expect(widget.getStateIcon(issue)).toContain('○');
    });
  });

  describe('renderLabels', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubIssuesWidget({ id: 'gi-19', data: {} });
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
      expect(html).toContain('github-issues-label');
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
      widget = new GitHubIssuesWidget({ id: 'gi-20', data: {} });
    });

    it('renders a basic issue item', () => {
      const issue = {
        title: 'Fix the bug',
        number: 42,
        html_url: 'https://github.com/octocat/repo/issues/42',
        state: 'open',
        user: { login: 'octocat', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
        updated_at: '2026-02-25T10:00:00Z',
        created_at: '2026-02-20T10:00:00Z',
        labels: [],
        comments: 0
      };
      const html = widget.renderItem(issue);
      expect(html).toContain('Fix the bug');
      expect(html).toContain('#42');
      expect(html).toContain('octocat');
      expect(html).toContain('https://github.com/octocat/repo/issues/42');
      expect(html).toContain('github-issues-state-open');
    });

    it('renders comment count when present', () => {
      const issue = {
        title: 'Issue with comments',
        number: 10,
        html_url: '#',
        state: 'open',
        user: { login: 'dev' },
        updated_at: '2026-02-25T10:00:00Z',
        labels: [],
        comments: 5
      };
      const html = widget.renderItem(issue);
      expect(html).toContain('💬');
      expect(html).toContain('5');
    });

    it('does not render comment count when zero', () => {
      const issue = {
        title: 'No comments',
        number: 11,
        html_url: '#',
        state: 'open',
        user: { login: 'dev' },
        updated_at: '2026-02-25T10:00:00Z',
        labels: [],
        comments: 0
      };
      const html = widget.renderItem(issue);
      expect(html).not.toContain('github-issues-comments');
    });

    it('renders avatar image when available', () => {
      const issue = {
        title: 'Issue', number: 1, html_url: '#', state: 'open',
        user: { login: 'user', avatar_url: 'https://example.com/avatar.png' },
        updated_at: '2026-02-25T10:00:00Z',
        labels: [], comments: 0
      };
      const html = widget.renderItem(issue);
      expect(html).toContain('ado-widget-avatar');
      expect(html).toContain('https://example.com/avatar.png');
    });

    it('renders initials when no avatar URL', () => {
      const issue = {
        title: 'Issue', number: 1, html_url: '#', state: 'open',
        user: { login: 'alice' },
        updated_at: '2026-02-25T10:00:00Z',
        labels: [], comments: 0
      };
      const html = widget.renderItem(issue);
      expect(html).toContain('ado-widget-avatar-initials');
      expect(html).toContain('AL');
    });
  });

  describe('fetchIssues', () => {
    let widget;

    beforeEach(() => {
      widget = new GitHubIssuesWidget({
        id: 'gi-21', data: { owner: 'octocat', repo: 'hello-world' }
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

      await widget.fetchIssues(null);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('https://api.github.com/repos/octocat/hello-world/issues');
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

      await widget.fetchIssues('ghp_test123');

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.headers.Authorization).toBe('Bearer ghp_test123');
    });

    it('does not include auth header when token is null', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await widget.fetchIssues(null);

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('includes labels parameter when set', async () => {
      widget.data.labels = 'bug,enhancement';
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await widget.fetchIssues(null);

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('labels=bug');
    });

    it('includes assignee parameter when set', async () => {
      widget.data.assignee = 'octocat';
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await widget.fetchIssues(null);

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('assignee=octocat');
    });

    it('includes milestone parameter when set', async () => {
      widget.data.milestone = '3';
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await widget.fetchIssues(null);

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('milestone=3');
    });

    it('filters out pull requests from results', async () => {
      const items = [
        { number: 1, title: 'Issue' },
        { number: 2, title: 'PR', pull_request: { url: 'https://...' } }
      ];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(items)
      });

      const result = await widget.fetchIssues(null);
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
    });

    it('filters by author on the client side', async () => {
      widget.data.author = 'Octocat';
      const issues = [
        { number: 1, user: { login: 'octocat' } },
        { number: 2, user: { login: 'other' } }
      ];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(issues)
      });

      const result = await widget.fetchIssues(null);
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
    });

    it('throws on 404 with descriptive message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ message: 'Not Found' }),
        url: 'https://api.github.com/repos/octocat/hello-world/issues'
      });

      await expect(widget.fetchIssues(null)).rejects.toThrow('Repository not found');
    });

    it('throws on 401 with auth message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'Bad credentials' }),
        url: 'https://api.github.com/repos/octocat/hello-world/issues'
      });

      await expect(widget.fetchIssues('token123')).rejects.toThrow('Authentication failed');
    });

    it('throws on 401 with gh cli message when authMode is ghcli', async () => {
      widget.data.authMode = 'ghcli';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'Bad credentials' }),
        url: 'https://api.github.com/repos/octocat/hello-world/issues'
      });

      await expect(widget.fetchIssues('token123')).rejects.toThrow('gh auth login');
    });

    it('throws on 403 rate limit with helpful message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ message: 'API rate limit exceeded' }),
        url: 'https://api.github.com/repos/octocat/hello-world/issues'
      });

      await expect(widget.fetchIssues(null)).rejects.toThrow('rate limit');
    });
  });

  describe('refresh with auth modes', () => {
    let widget;

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('uses PAT token when authMode is pat', async () => {
      widget = new GitHubIssuesWidget({
        id: 'gi-auth-1',
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
      widget = new GitHubIssuesWidget({
        id: 'gi-auth-2',
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
      widget = new GitHubIssuesWidget({
        id: 'gi-22', data: { owner: 'octocat', repo: 'hello-world' }
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
      const issues = [{ number: 1, title: 'Test Issue' }];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(issues)
      });

      await widget.refresh();

      expect(widget.items).toEqual(issues);
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
