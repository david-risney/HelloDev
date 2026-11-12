import { DevDashWidget } from './DevDashWidget.js';

export class GitHubIssuesWidget extends DevDashWidget {
  static metadata = { name: 'GitHub Issues', icon: '\u{1F41B}', group: 'GitHub', defaultSize: { width: 4, height: 4 } };
  constructor(config) { super({ ...config, type: 'githubissues' }); }
}
