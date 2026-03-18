import { WidgetBase } from './WidgetBase.js';
import { escapeHtml } from '../htmlUtils.js';

/**
 * Search widget - web search input with support for multiple search templates.
 *
 * Data shape:
 *   searchTemplates - array of { name, urlTemplate, placeholder }
 *   activeTemplate  - index into searchTemplates (default 0)
 *
 * Legacy data (urlTemplate / placeholder at top level) is migrated
 * automatically in the constructor.
 */
export class SearchWidget extends WidgetBase {
  static metadata = {
    name: 'Search',
    icon: '🔍',
    group: 'Utility',
    defaultSize: { width: 4, height: 1 }
  };

  static DEFAULT_URL_TEMPLATE = 'https://www.google.com/search?q={query}';

  static DEFAULT_TEMPLATES = [
    { name: 'Google', urlTemplate: 'https://www.google.com/search?q={query}', placeholder: 'Search Google...' }
  ];

  constructor(config) {
    super({ ...config, type: 'search' });

    // Migrate legacy single-template data
    if (!this.data.searchTemplates) {
      const url = this.data.urlTemplate || SearchWidget.DEFAULT_URL_TEMPLATE;
      const ph = this.data.placeholder || 'Search the web...';
      this.data.searchTemplates = [{ name: 'Search', urlTemplate: url, placeholder: ph }];
      delete this.data.urlTemplate;
      delete this.data.placeholder;
    }

    if (this.data.activeTemplate == null) {
      this.data.activeTemplate = 0;
    }
  }

  /** Return the currently-active template (safe index). */
  _activeTemplate() {
    const templates = this.data.searchTemplates;
    const idx = Math.max(0, Math.min(this.data.activeTemplate ?? 0, templates.length - 1));
    return templates[idx];
  }

  getConfigSchema() {
    return [
      {
        key: 'searchTemplates',
        label: 'Search Templates',
        type: 'list',
        fields: [
          { key: 'name', label: 'Name' },
          { key: 'urlTemplate', label: 'URL Template ({query})' },
          { key: 'placeholder', label: 'Placeholder Text' }
        ],
        default: SearchWidget.DEFAULT_TEMPLATES
      }
    ];
  }

  getContent() {
    const templates = this.data.searchTemplates;
    const active = this._activeTemplate();
    const placeholder = active.placeholder || 'Search the web...';

    let html = '<div class="search-widget-bar">';
    html += `<input type="text" class="search-input" placeholder="${escapeHtml(placeholder)}">`;

    if (templates.length > 1) {
      html += '<select class="search-template-select">';
      templates.forEach((t, i) => {
        const selected = i === (this.data.activeTemplate ?? 0) ? ' selected' : '';
        const label = escapeHtml(t.name || `Template ${i + 1}`);
        html += `<option value="${i}"${selected}>${label}</option>`;
      });
      html += '</select>';
    }

    html += '</div>';
    return html;
  }

  setupBehavior(element) {
    const input = element.querySelector('.search-input');
    const select = element.querySelector('.search-template-select');

    if (select) {
      select.addEventListener('change', () => {
        this.data.activeTemplate = parseInt(select.value, 10);
        const active = this._activeTemplate();
        if (input) {
          input.placeholder = active.placeholder || 'Search the web...';
        }
      });
    }

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          const active = this._activeTemplate();
          const template = active.urlTemplate || SearchWidget.DEFAULT_URL_TEMPLATE;
          const searchUrl = template.replace('{query}', encodeURIComponent(input.value.trim()));
          try {
            const parsed = new URL(searchUrl);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
          } catch {
            return;
          }
          window.location.href = searchUrl;
        }
      });
    }
  }
}
