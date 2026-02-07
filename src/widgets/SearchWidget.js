import { WidgetBase } from './WidgetBase.js';

/**
 * Search widget - web search input
 */
export class SearchWidget extends WidgetBase {
  static metadata = {
    name: 'Search',
    icon: '🔍'
  };

  static DEFAULT_URL_TEMPLATE = 'https://www.google.com/search?q={query}';

  constructor(config) {
    super({ ...config, type: 'search' });
    if (!this.data.urlTemplate) {
      this.data.urlTemplate = SearchWidget.DEFAULT_URL_TEMPLATE;
    }
  }

  getConfigSchema() {
    return [
      {
        key: 'urlTemplate',
        label: 'Search URL Template',
        type: 'string',
        default: 'https://www.google.com/search?q={query}'
      },
      {
        key: 'placeholder',
        label: 'Placeholder Text',
        type: 'string',
        default: 'Search the web...'
      }
    ];
  }

  getContent() {
    const placeholder = this.data.placeholder ?? 'Search the web...';
    return `
      <input type="text" class="search-input" placeholder="${placeholder}">
    `;
  }

  setupBehavior(element) {
    const input = element.querySelector('.search-input');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          const template = this.data.urlTemplate || SearchWidget.DEFAULT_URL_TEMPLATE;
          const searchUrl = template.replace('{query}', encodeURIComponent(input.value.trim()));
          window.location.href = searchUrl;
        }
      });
    }
  }
}
