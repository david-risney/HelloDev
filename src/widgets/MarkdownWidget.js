import { WidgetBase } from './WidgetBase.js';
import { MarkdownHelper } from '../MarkdownHelper.js';

/**
 * Markdown widget - displays rendered markdown content
 */
export class MarkdownWidget extends WidgetBase {
  static metadata = {
    name: 'Markdown',
    icon: '📄',
    group: 'Utility',
    defaultSize: { width: 4, height: 3 }
  };

  constructor(config) {
    super({ ...config, type: 'markdown' });
    if (!this.data.markdown) {
      this.data.markdown = '# Hello\n\nEdit this widget to add your **markdown** content.';
    }
    // Track current view mode: 'rendered' or 'source' (persisted)
    this.viewMode = this.data.viewMode || 'rendered';
    // Track lock state: locked = not editable (persisted)
    this.isLocked = this.data.isLocked !== undefined ? this.data.isLocked : true;
  }

  getConfigSchema() {
    return [
      {
        key: 'markdown',
        label: 'Markdown Content',
        type: 'text',
        default: '# Hello\n\nEdit this widget to add your **markdown** content.'
      }
    ];
  }

  getContent() {
    const markdown = this.data.markdown || '';
    if (this.viewMode === 'source') {
      // Show markdown source - editable only when unlocked
      const escaped = markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const readonlyAttr = this.isLocked ? ' readonly' : '';
      return `<textarea class="widget-markdown-source"${readonlyAttr} spellcheck="false">${escaped}</textarea>`;
    }
    const html = MarkdownHelper.toHtml(markdown);
    const editableAttr = this.isLocked ? 'false' : 'true';
    return `<div class="widget-markdown-content" contenteditable="${editableAttr}" spellcheck="false">${html}</div>`;
  }

  /**
   * Override createElement to add lock and mode toggle buttons
   */
  createElement(removeWidget, resizeWidget, openWidgetConfig) {
    const el = super.createElement(removeWidget, resizeWidget, openWidgetConfig);
    
    // Add lock/unlock button (leftmost)
    const lockBtn = document.createElement('button');
    lockBtn.className = 'widget-control lock-toggle';
    lockBtn.title = this.isLocked ? 'Unlock to edit' : 'Lock editing';
    lockBtn.textContent = this.isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13';
    el.insertBefore(lockBtn, el.firstChild);
    
    // Add mode toggle button (next to lock)
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'widget-control mode-toggle';
    toggleBtn.title = 'Toggle view mode';
    toggleBtn.textContent = this.viewMode === 'rendered' ? '\uD83D\uDCDD' : '\uD83D\uDC40';
    el.insertBefore(toggleBtn, el.firstChild);
    
    // Add click handler for lock button
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLock();
    });
    
    // Add click handler for toggle button
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleViewMode();
    });
    
    // Auto-save on blur for both rendered and source modes
    el.addEventListener('focusout', (e) => {
      // Only save if the focus is leaving the editable content
      const content = el.querySelector('.widget-content');
      if (content && !content.contains(e.relatedTarget)) {
        this.saveContent();
      }
    });
    
    return el;
  }

  /**
   * Save current content to data and trigger storage save
   */
  saveContent() {
    if (this.viewMode === 'source') {
      const textarea = this.element?.querySelector('.widget-markdown-source');
      if (textarea && textarea.value !== this.data.markdown) {
        this.data.markdown = textarea.value;
        this.element?.dispatchEvent(new CustomEvent('widget-changed', { bubbles: true }));
      }
    } else {
      const contentEl = this.element?.querySelector('.widget-markdown-content');
      if (contentEl) {
        const newMarkdown = MarkdownHelper.toMarkdown(contentEl);
        if (newMarkdown !== this.data.markdown) {
          this.data.markdown = newMarkdown;
          this.element?.dispatchEvent(new CustomEvent('widget-changed', { bubbles: true }));
        }
      }
    }
  }

  /**
   * Toggle between rendered and source view modes
   */
  toggleViewMode() {
    // Save content before switching modes
    this.saveContent();
    
    this.viewMode = this.viewMode === 'rendered' ? 'source' : 'rendered';
    this.data.viewMode = this.viewMode;
    
    // Update button icon
    const toggleBtn = this.element?.querySelector('.widget-control.mode-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = this.viewMode === 'rendered' ? '\uD83D\uDCDD' : '\uD83D\uDC40';
      toggleBtn.title = this.viewMode === 'rendered' ? 'View source' : 'View rendered';
    }
    
    // Re-render content
    const contentEl = this.element?.querySelector('.widget-content');
    if (contentEl) {
      contentEl.innerHTML = this.getContent();
    }
    
    // Save state
    this.element?.dispatchEvent(new CustomEvent('widget-changed', { bubbles: true }));
  }

  /**
   * Toggle lock/unlock state
   */
  toggleLock() {
    // Save content before locking
    if (!this.isLocked) {
      this.saveContent();
    }
    
    this.isLocked = !this.isLocked;
    this.data.isLocked = this.isLocked;
    
    // Update button icon
    const lockBtn = this.element?.querySelector('.widget-control.lock-toggle');
    if (lockBtn) {
      lockBtn.textContent = this.isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13';
      lockBtn.title = this.isLocked ? 'Unlock to edit' : 'Lock editing';
    }
    
    // Re-render content with new editability
    const contentEl = this.element?.querySelector('.widget-content');
    if (contentEl) {
      contentEl.innerHTML = this.getContent();
    }
    
    // Save state
    this.element?.dispatchEvent(new CustomEvent('widget-changed', { bubbles: true }));
  }
}
