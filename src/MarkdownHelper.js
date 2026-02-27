/**
 * Helper class for converting between Markdown and HTML
 */
export class MarkdownHelper {
  /**
   * Convert markdown text to HTML
   * Supports: headings, bold, italic, links, lists (with sublists), code, blockquotes, horizontal rules
   * @param {string} markdown - Markdown source text
   * @returns {string} HTML string
   */
  static toHtml(markdown) {
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
   * Convert HTML element back to markdown
   * @param {HTMLElement} element - HTML element to convert
   * @returns {string} Markdown string
   */
  static toMarkdown(element) {
    const lines = [];
    
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      
      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(processNode).join('');
      
      switch (tag) {
        case 'h1': return `# ${children}`;
        case 'h2': return `## ${children}`;
        case 'h3': return `### ${children}`;
        case 'h4': return `#### ${children}`;
        case 'h5': return `##### ${children}`;
        case 'strong':
        case 'b': return `**${children}**`;
        case 'em':
        case 'i': return `*${children}*`;
        case 'code': return `\`${children}\``;
        case 'a': return `[${children}](${node.getAttribute('href') || ''})`;
        case 'blockquote': return `> ${children}`;
        case 'hr': return '---';
        case 'br': return '\n';
        case 'input':
          // Handle checkbox inputs
          if (node.type === 'checkbox') {
            return node.checked ? '[x] ' : '[ ] ';
          }
          return '';
        case 'li': return children;
        case 'ul':
        case 'ol':
          return Array.from(node.children).map((li, i) => {
            const prefix = tag === 'ol' ? `${i + 1}. ` : '- ';
            return prefix + processNode(li);
          }).join('\n');
        case 'p':
        case 'div':
          return children;
        default:
          return children;
      }
    };
    
    Array.from(element.childNodes).forEach(node => {
      const result = processNode(node);
      if (result.trim()) {
        lines.push(result);
      }
    });
    
    return lines.join('\n\n');
  }

  /**
   * Parse a list starting at the given index
   * @private
   */
  static parseList(lines, startIndex) {
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
        // Same level item - check for checkbox
        let content = match[3];
        let hasCheckbox = false;
        const checkboxMatch = content.match(/^\[([ xX])\]\s*(.*)$/);
        if (checkboxMatch) {
          const checked = checkboxMatch[1].toLowerCase() === 'x';
          content = `<input type="checkbox"${checked ? ' checked' : ''}> ` + this.parseInline(checkboxMatch[2]);
          hasCheckbox = true;
        } else {
          content = this.parseInline(content);
        }
        items.push({ content, children: null, hasCheckbox });
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
      const liClass = item.hasCheckbox ? ' class="has-checkbox"' : '';
      if (item.children) {
        return `<li${liClass}>${item.content}\n${item.children}</li>`;
      }
      return `<li${liClass}>${item.content}</li>`;
    }).join('\n');

    return { html: `<${tag}>${listHtml}</${tag}>`, endIndex: i };
  }

  /**
   * Parse a single line (non-list)
   * @private
   */
  static parseLine(line) {
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
   * @private
   */
  static parseInline(text) {
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
      
      // Links — fragment-only URLs stay in-page; others open in a new tab
      .replace(/\[(.+?)\]\((.+?)\)/g, (_match, text, url) => {
        const attrs = url.startsWith('#') ? '' : ' target="_blank"';
        return `<a href="${url}"${attrs}>${text}</a>`;
      });
  }
}
