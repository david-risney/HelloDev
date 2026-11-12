import { DevDashWidget } from './DevDashWidget.js';

export class ChromiumBugsWidget extends DevDashWidget {
  static metadata = { name: 'Chromium Bugs', icon: '\u{1F41B}', group: 'Chromium', defaultSize: { width: 4, height: 4 } };
  constructor(config) { super({ ...config, type: 'chromiumbug' }); }
}
