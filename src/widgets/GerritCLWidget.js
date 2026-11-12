import { DevDashWidget } from './DevDashWidget.js';

export class GerritCLWidget extends DevDashWidget {
  static metadata = { name: 'Chromium CLs', icon: '\u{1F500}', group: 'Chromium', defaultSize: { width: 4, height: 4 } };
  constructor(config) { super({ ...config, type: 'gerritcl' }); }
}
