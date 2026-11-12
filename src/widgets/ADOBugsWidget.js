import { DevDashWidget } from './DevDashWidget.js';

export class ADOBugsWidget extends DevDashWidget {
  static metadata = { name: 'ADO Bugs', icon: '\u{1F41B}', group: 'ADO', defaultSize: { width: 4, height: 4 } };
  constructor(config) { super({ ...config, type: 'adobugs' }); }
}
