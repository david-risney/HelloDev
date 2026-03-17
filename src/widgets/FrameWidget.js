import { WidgetBase } from './WidgetBase.js';

/**
 * Frame widget - embeds a webpage in an iframe with navigation controls
 */
export class FrameWidget extends WidgetBase {
  static metadata = {
    name: 'Frame',
    icon: '🌐',
    group: 'Utility',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'frame' });
  }

  getConfigSchema() {
    return [
      {
        key: 'url',
        label: 'URL',
        type: 'string',
        default: ''
      }
    ];
  }

  static isSafeUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  getContent() {
    const url = this.data.url || '';
    if (!url) {
      return `
        <div class="widget-frame-empty">
          <div class="widget-frame-icon">🌐</div>
          <div>Configure a URL to display</div>
        </div>
      `;
    }
    if (!FrameWidget.isSafeUrl(url)) {
      return `
        <div class="widget-frame-empty">
          <div class="widget-frame-icon">⚠️</div>
          <div>Invalid URL — only http and https are allowed</div>
        </div>
      `;
    }
    const escaped = this.escapeHtml(url);
    return `
      <div class="widget-frame-toolbar">
        <button class="widget-frame-btn frame-back" title="Back">◀</button>
        <button class="widget-frame-btn frame-forward" title="Forward">▶</button>
        <button class="widget-frame-btn frame-home" title="Home">⌂</button>
        <span class="widget-frame-url" title="${escaped}">${escaped}</span>
      </div>
      <iframe class="widget-frame-iframe" src="${escaped}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>
    `;
  }

  setupBehavior(element) {
    const iframe = element.querySelector('.widget-frame-iframe');
    if (!iframe) return;

    const backBtn = element.querySelector('.frame-back');
    const forwardBtn = element.querySelector('.frame-forward');
    const homeBtn = element.querySelector('.frame-home');

    backBtn?.addEventListener('click', () => {
      try {
        iframe.contentWindow.history.back();
      } catch (e) {
        // cross-origin restriction
      }
    });

    forwardBtn?.addEventListener('click', () => {
      try {
        iframe.contentWindow.history.forward();
      } catch (e) {
        // cross-origin restriction
      }
    });

    homeBtn?.addEventListener('click', () => {
      const url = this.data.url || '';
      if (url && FrameWidget.isSafeUrl(url)) {
        iframe.src = url;
      }
    });
  }
}
