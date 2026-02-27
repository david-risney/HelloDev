// Widget Packs — predefined bundles that add multiple widgets at once.
// Each pack describes itself, asks the user for a few properties via a schema,
// then returns an array of widget configs based on those answers.

/**
 * Widget Pack definition:
 *   id          — unique string key
 *   name        — display name
 *   icon        — emoji icon
 *   description — short description shown in the flyout
 *   properties  — array of field definitions (same shape as widget config schema)
 *   createWidgets(props) — returns an array of partial widget configs
 */
export const WidgetPacks = [
  {
    id: 'github-dev',
    name: 'GitHub Dev',
    icon: '\u{1F4E6}',
    description: 'Monitor your bugs, your PRs, and PRs that need your attention',
    properties: [
      { key: 'owner', label: 'Owner / Org', type: 'string', default: '', placeholder: 'david-risney' },
      { key: 'repo', label: 'Repository', type: 'string', default: '', placeholder: 'HelloDev' },
      {
        key: 'authMode', label: 'Auth Mode', type: 'select',
        options: [
          { value: 'none', label: 'None (public repos)' },
          { value: 'pat', label: 'Personal Access Token' },
          { value: 'ghcli', label: 'GitHub CLI (gh)' }
        ],
        default: 'none'
      }
    ],
    createWidgets(props) {
      return [
        {
          type: 'githubpr',
          width: 4,
          height: 4,
          data: {
            owner: props.owner,
            repo: props.repo,
            authMode: props.authMode,
            title: `${props.repo} PRs`
          }
        },
        {
          type: 'githubissues',
          width: 4,
          height: 4,
          data: {
            owner: props.owner,
            repo: props.repo,
            authMode: props.authMode,
            title: `${props.repo} Issues`
          }
        }
      ];
    }
  },

  {
    id: 'ado-dev',
    name: 'ADO Dev',
    icon: '\ud83d\udd37',
    description: 'Monitor your bugs, your PRs, and PRs that need your attention',
    properties: [
      { key: 'organization', label: 'Organization', type: 'string', default: '', placeholder: 'microsoft' },
      { key: 'project', label: 'Project', type: 'string', default: '', placeholder: 'Edge' },
      { key: 'email', label: 'Your Email', type: 'string', default: '', placeholder: 'alias@microsoft.com' }
    ],
    createWidgets(props) {
      return [
        {
          type: 'adopr',
          width: 4,
          height: 4,
          data: {
            organization: props.organization,
            project: props.project,
            creatorEmail: props.email,
            title: 'My PRs'
          }
        },
        {
          type: 'adopr',
          width: 4,
          height: 4,
          data: {
            organization: props.organization,
            project: props.project,
            reviewerEmail: props.email,
            title: 'PRs to Review'
          }
        },
        {
          type: 'adobugs',
          width: 4,
          height: 4,
          data: {
            organization: props.organization,
            project: props.project,
            assignedTo: props.email,
            title: 'My Bugs'
          }
        }
      ];
    }
  },

  {
    id: 'chromium-dev',
    name: 'Chromium Dev',
    icon: '\ud83c\udf10',
    description: 'My CLs, reviews, and bugs for Chromium',
    properties: [
      { key: 'email', label: 'Your Email', type: 'string', default: '', placeholder: 'user@chromium.org' }
    ],
    createWidgets(props) {
      return [
        {
          type: 'gerritcl',
          width: 4,
          height: 4,
          data: {
            query: `status:open owner:${props.email}`,
            title: 'My CLs'
          }
        },
        {
          type: 'gerritcl',
          width: 4,
          height: 4,
          data: {
            query: `status:open attention:${props.email}`,
            title: 'CLs to Review'
          }
        },
        {
          type: 'chromiumbug',
          width: 4,
          height: 4,
          data: {
            query: `status:open assignee:${props.email}`,
            title: 'My Bugs'
          }
        }
      ];
    }
  },

  {
    id: 'starter-dashboard',
    name: 'Starter Dashboard',
    icon: '\ud83d\ude80',
    description: 'Clock, Search, and a notes widget',
    properties: [
      { key: 'name', label: 'Your Name', type: 'string', default: '' },
      {
        key: 'searchEngine', label: 'Search Engine', type: 'select',
        options: [
          { value: 'https://www.google.com/search?q={query}', label: 'Google' },
          { value: 'https://www.bing.com/search?q={query}', label: 'Bing' },
          { value: 'https://duckduckgo.com/?q={query}', label: 'DuckDuckGo' }
        ],
        default: 'https://www.google.com/search?q={query}'
      }
    ],
    createWidgets(props) {
      return [
        {
          type: 'clock',
          width: 3,
          height: 2,
          data: { name: props.name, style: 'Classic' }
        },
        {
          type: 'search',
          width: 4,
          height: 1,
          data: { urlTemplate: props.searchEngine }
        },
        {
          type: 'markdown',
          width: 4,
          height: 3,
          data: {
            markdown: `# Notes\n\nStart typing here…`,
            viewMode: 'rendered'
          }
        }
      ];
    }
  }
];
