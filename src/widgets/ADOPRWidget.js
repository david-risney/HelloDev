import { DevDashWidget } from './DevDashWidget.js';

export class ADOPRWidget extends DevDashWidget {
  static metadata = { name: 'ADO PRs', icon: '\u{1F500}', group: 'ADO', defaultSize: { width: 4, height: 4 } };
  constructor(config) { super({ ...config, type: 'adopr' }); }
}
