import { WidgetBase } from './WidgetBase.js';

/**
 * Links widget - quick links list
 */
export class LinksWidget extends WidgetBase {
  constructor(config) {
    super({ ...config, type: 'links' });
    if (!this.data.links) {
      this.data.links = [
        { name: 'GitHub', url: 'https://github.com' },
        { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
        { name: 'MDN Docs', url: 'https://developer.mozilla.org' }
      ];
    }
  }

  getConfigSchema() {
    return [
      {
        key: 'links',
        label: 'Links',
        type: 'list',
        fields: [
          { key: 'name', label: 'Name', type: 'string' },
          { key: 'url', label: 'URL', type: 'string' }
        ],
        default: []
      }
    ];
  }

  getContent() {
    return `
      <ul class="widget-links-list">
        ${this.data.links.map(link => `
          <li><a href="${link.url}" target="_blank">🔗 ${link.name}</a></li>
        `).join('')}
      </ul>
    `;
  }
}
