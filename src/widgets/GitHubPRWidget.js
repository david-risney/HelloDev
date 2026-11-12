import { DevDashWidget } from './DevDashWidget.js';

export class GitHubPRWidget extends DevDashWidget {
  static metadata = { name: 'GitHub PRs', icon: '\u{1F500}', group: 'GitHub', defaultSize: { width: 4, height: 4 } };
  constructor(config) { super({ ...config, type: 'githubpr' }); }
}
