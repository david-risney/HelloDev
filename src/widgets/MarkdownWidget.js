import { WidgetBase } from './WidgetBase.js';

/**
 * Markdown widget - displays rendered markdown content
 */
export class MarkdownWidget extends WidgetBase {
  constructor(config) {
    super({ ...config, type: 'markdown' });
    if (!this.data.markdown) {
      this.data.markdown = '# Hello\n\nEdit this widget to add your **markdown** content.';
    }
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
    const html = this.parseMarkdown(this.data.markdown || '');
    return `<div class="widget-markdown-content">${html}</div>`;
  }

  /**
   * Simple markdown parser - converts markdown to HTML
   * Supports: headings, bold, italic, links, lists (with sublists), code, blockquotes, horizontal rules
   */
  parseMarkdown(markdown) {
    const lines = markdown.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      
      // Check for list items (unordered or ordered)
      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        const { html, endIndex } = this.parseList(lines, i);
        result.push(html);
        i = endIndex;
        continue;
      }

      // Process other line types
      result.push(this.parseLine(line));
      i++;
    }

    let html = result.join('\n')
      // Fix nested blockquotes
      .replace(/<\/blockquote>\n<blockquote>/g, '<br>');

    return html;
  }

  /**
   * Parse a list starting at the given index
   */
  parseList(lines, startIndex) {
    const items = [];
    let i = startIndex;
    const firstMatch = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    const baseIndent = firstMatch[1].length;
    const isOrdered = /^\d+\./.test(firstMatch[2]);

    while (i < lines.length) {
      const line = lines[i];
      const match = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
      
      if (!match) break;
      
      const indent = match[1].length;
      
      if (indent < baseIndent) break;
      
      if (indent === baseIndent) {
        // Same level item
        items.push({ content: this.parseInline(match[3]), children: null });
        i++;
      } else {
        // Sublist - parse recursively
        const { html, endIndex } = this.parseList(lines, i);
        if (items.length > 0) {
          items[items.length - 1].children = html;
        }
        i = endIndex;
      }
    }

    const tag = isOrdered ? 'ol' : 'ul';
    const listHtml = items.map(item => {
      if (item.children) {
        return `<li>${item.content}\n${item.children}</li>`;
      }
      return `<li>${item.content}</li>`;
    }).join('\n');

    return { html: `<${tag}>${listHtml}</${tag}>`, endIndex: i };
  }

  /**
   * Parse a single line (non-list)
   */
  parseLine(line) {
    // Escape HTML first
    let escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    if (/^##### (.+)$/.test(escaped)) return escaped.replace(/^##### (.+)$/, '<h5>$1</h5>');
    if (/^#### (.+)$/.test(escaped)) return escaped.replace(/^#### (.+)$/, '<h4>$1</h4>');
    if (/^### (.+)$/.test(escaped)) return escaped.replace(/^### (.+)$/, '<h3>$1</h3>');
    if (/^## (.+)$/.test(escaped)) return escaped.replace(/^## (.+)$/, '<h2>$1</h2>');
    if (/^# (.+)$/.test(escaped)) return escaped.replace(/^# (.+)$/, '<h1>$1</h1>');

    // Horizontal rule
    if (/^---$/.test(escaped)) return '<hr>';

    // Blockquote
    if (/^&gt; (.+)$/.test(escaped)) return escaped.replace(/^&gt; (.+)$/, '<blockquote>$1</blockquote>');

    // Empty line
    if (escaped.trim() === '') return '';

    // Paragraph with inline formatting
    return `<p>${this.parseInline(escaped)}</p>`;
  }

  /**
   * Parse inline formatting (bold, italic, code, links)
   */
  parseInline(text) {
    return text
      // Escape HTML if not already escaped
      .replace(/&(?!amp;|lt;|gt;)/g, '&amp;')
      
      // Bold and italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      
      // Links
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
  }
}
