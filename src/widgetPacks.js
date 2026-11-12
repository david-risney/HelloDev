function devDashPack(id, name, icon, widgets) {
  return {
    id, name, icon,
    description: 'Arrange existing DevDash queries. Configure provider filters and sign-in in DevDash.',
    properties: [
      { key: 'profile', label: 'DevDash profile', type: 'string', default: '' },
      ...widgets.map(({ key, title }) => ({
        key, label: `${title}: named query (empty for a flat profile)`, type: 'string', default: ''
      }))
    ],
    createWidgets(props) {
      return widgets.map(({ key, title, type }) => ({
        type, width: 4, height: 4,
        data: { profile: props.profile, queryName: props[key], title }
      }));
    }
  };
}

export const WidgetPacks = [
  devDashPack('devdash', 'DevDash', '\u{1F4CB}', [
    { key: 'bugs', title: 'Bugs', type: 'devdash' },
    { key: 'prs', title: 'My PRs', type: 'devdash' },
    { key: 'reviews', title: 'Reviews', type: 'devdash' }
  ]),
  devDashPack('github-dev', 'GitHub Dev', '\u{1F4E6}', [
    { key: 'prs', title: 'GitHub PRs', type: 'githubpr' },
    { key: 'bugs', title: 'GitHub Issues', type: 'githubissues' }
  ]),
  devDashPack('ado-dev', 'ADO Dev', '\u{1F537}', [
    { key: 'prs', title: 'My PRs', type: 'adopr' },
    { key: 'reviews', title: 'PRs to Review', type: 'adopr' },
    { key: 'bugs', title: 'My Bugs', type: 'adobugs' }
  ]),
  devDashPack('chromium-dev', 'Chromium Dev', '\u{1F310}', [
    { key: 'prs', title: 'My CLs', type: 'gerritcl' },
    { key: 'reviews', title: 'CLs to Review', type: 'gerritcl' },
    { key: 'bugs', title: 'My Bugs', type: 'chromiumbug' }
  ]),
  {
    id: 'starter-dashboard',
    name: 'Starter Dashboard',
    icon: '\u{1F680}',
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
        { type: 'clock', width: 3, height: 2, data: { name: props.name, style: 'Classic' } },
        {
          type: 'search', width: 4, height: 1,
          data: { searchTemplates: [{ name: 'Search', urlTemplate: props.searchEngine, placeholder: 'Search the web...' }] }
        },
        { type: 'markdown', width: 4, height: 3, data: { markdown: '# Notes\n\nStart typing here...', viewMode: 'rendered' } }
      ];
    }
  }
];
