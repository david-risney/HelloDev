import { WidgetBase } from './WidgetBase.js';

/**
 * Notes widget - quick notes textarea
 */
export class NotesWidget extends WidgetBase {
  static metadata = {
    name: 'Notes',
    icon: '📝'
  };

  constructor(config) {
    super({ ...config, type: 'notes' });
    this.saveWidgets = null; // Will be set by the dashboard
  }

  getConfigSchema() {
    return [
      {
        key: 'title',
        label: 'Title',
        type: 'string',
        default: 'Quick Notes'
      }
    ];
  }

  getContent() {
    const title = this.data.title ?? 'Quick Notes';
    const noteData = this.data.content || '';
    return `
      <div class="widget-notes-title">${title}</div>
      <textarea class="notes-textarea" placeholder="Type your notes here...">${noteData}</textarea>
    `;
  }

  setupBehavior(element) {
    const textarea = element.querySelector('.notes-textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        this.data = this.data || {};
        this.data.content = textarea.value;
        if (this.saveWidgets) {
          this.saveWidgets();
        }
      });
    }
  }
}
