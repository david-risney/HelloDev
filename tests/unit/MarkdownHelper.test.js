import { describe, it, expect } from 'vitest';
import { MarkdownHelper } from '../../src/MarkdownHelper.js';

describe('MarkdownHelper', () => {
  describe('toHtml', () => {
    describe('headings', () => {
      it('converts h1', () => {
        expect(MarkdownHelper.toHtml('# Hello')).toContain('<h1>Hello</h1>');
      });

      it('converts h2', () => {
        expect(MarkdownHelper.toHtml('## Sub')).toContain('<h2>Sub</h2>');
      });

      it('converts h3', () => {
        expect(MarkdownHelper.toHtml('### Sub Sub')).toContain('<h3>Sub Sub</h3>');
      });

      it('converts h4', () => {
        expect(MarkdownHelper.toHtml('#### Level 4')).toContain('<h4>Level 4</h4>');
      });

      it('converts h5', () => {
        expect(MarkdownHelper.toHtml('##### Level 5')).toContain('<h5>Level 5</h5>');
      });
    });

    describe('inline formatting', () => {
      it('converts bold with **', () => {
        const html = MarkdownHelper.toHtml('Some **bold** text');
        expect(html).toContain('<strong>bold</strong>');
      });

      it('converts bold with __', () => {
        const html = MarkdownHelper.toHtml('Some __bold__ text');
        expect(html).toContain('<strong>bold</strong>');
      });

      it('converts italic with *', () => {
        const html = MarkdownHelper.toHtml('Some *italic* text');
        expect(html).toContain('<em>italic</em>');
      });

      it('converts italic with _', () => {
        const html = MarkdownHelper.toHtml('Some _italic_ text');
        expect(html).toContain('<em>italic</em>');
      });

      it('converts bold+italic with ***', () => {
        const html = MarkdownHelper.toHtml('Some ***both*** text');
        expect(html).toContain('<strong><em>both</em></strong>');
      });

      it('converts inline code', () => {
        const html = MarkdownHelper.toHtml('Use `code` here');
        expect(html).toContain('<code>code</code>');
      });

      it('converts links', () => {
        const html = MarkdownHelper.toHtml('Visit [Google](https://google.com)');
        expect(html).toContain('<a href="https://google.com"');
        expect(html).toContain('>Google</a>');
      });
    });

    describe('block elements', () => {
      it('converts horizontal rules', () => {
        expect(MarkdownHelper.toHtml('---')).toContain('<hr>');
      });

      it('converts blockquotes', () => {
        const html = MarkdownHelper.toHtml('> This is a quote');
        expect(html).toContain('<blockquote>');
        expect(html).toContain('This is a quote');
      });

      it('wraps plain text in paragraphs', () => {
        const html = MarkdownHelper.toHtml('Hello world');
        expect(html).toContain('<p>Hello world</p>');
      });

      it('skips empty lines', () => {
        const html = MarkdownHelper.toHtml('Line 1\n\nLine 2');
        expect(html).toContain('<p>Line 1</p>');
        expect(html).toContain('<p>Line 2</p>');
      });
    });

    describe('lists', () => {
      it('converts unordered lists with -', () => {
        const html = MarkdownHelper.toHtml('- Item 1\n- Item 2');
        expect(html).toContain('<ul>');
        expect(html).toContain('<li>Item 1</li>');
        expect(html).toContain('<li>Item 2</li>');
        expect(html).toContain('</ul>');
      });

      it('converts unordered lists with *', () => {
        const html = MarkdownHelper.toHtml('* Item A\n* Item B');
        expect(html).toContain('<ul>');
        expect(html).toContain('<li>Item A</li>');
        expect(html).toContain('<li>Item B</li>');
      });

      it('converts ordered lists', () => {
        const html = MarkdownHelper.toHtml('1. First\n2. Second');
        expect(html).toContain('<ol>');
        expect(html).toContain('<li>First</li>');
        expect(html).toContain('<li>Second</li>');
        expect(html).toContain('</ol>');
      });

      it('converts nested lists (sublists)', () => {
        const md = '- Parent\n  - Child';
        const html = MarkdownHelper.toHtml(md);
        expect(html).toContain('<ul>');
        expect(html).toContain('Parent');
        expect(html).toContain('Child');
      });

      it('converts checkboxes (unchecked)', () => {
        const html = MarkdownHelper.toHtml('- [ ] Todo');
        expect(html).toContain('<input type="checkbox">');
        expect(html).toContain('Todo');
        expect(html).toContain('has-checkbox');
      });

      it('converts checkboxes (checked)', () => {
        const html = MarkdownHelper.toHtml('- [x] Done');
        expect(html).toContain('<input type="checkbox" checked>');
        expect(html).toContain('Done');
      });
    });

    describe('HTML escaping', () => {
      it('escapes HTML in regular text', () => {
        const html = MarkdownHelper.toHtml('Use <script> tags');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
      });

      it('escapes HTML in headings', () => {
        const html = MarkdownHelper.toHtml('# <Alert>');
        expect(html).not.toContain('< Alert>');
        expect(html).toContain('&lt;Alert&gt;');
      });
    });

    describe('combined content', () => {
      it('handles a full document', () => {
        const md = `# Title

Some *text* with **bold**.

- Item 1
- Item 2

> A quote

---`;
        const html = MarkdownHelper.toHtml(md);
        expect(html).toContain('<h1>Title</h1>');
        expect(html).toContain('<em>text</em>');
        expect(html).toContain('<strong>bold</strong>');
        expect(html).toContain('<ul>');
        expect(html).toContain('<blockquote>');
        expect(html).toContain('<hr>');
      });
    });
  });

  describe('toMarkdown', () => {
    it('converts headings back to markdown', () => {
      const el = document.createElement('div');
      el.innerHTML = '<h1>Title</h1><h2>Subtitle</h2>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('# Title');
      expect(md).toContain('## Subtitle');
    });

    it('converts bold and italic', () => {
      const el = document.createElement('div');
      el.innerHTML = '<p><strong>bold</strong> and <em>italic</em></p>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('**bold**');
      expect(md).toContain('*italic*');
    });

    it('converts links', () => {
      const el = document.createElement('div');
      el.innerHTML = '<a href="https://test.com">Test</a>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('[Test](https://test.com)');
    });

    it('converts inline code', () => {
      const el = document.createElement('div');
      el.innerHTML = '<p>Use <code>foo()</code> here</p>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('`foo()`');
    });

    it('converts unordered lists', () => {
      const el = document.createElement('div');
      el.innerHTML = '<ul><li>Alpha</li><li>Beta</li></ul>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('- Alpha');
      expect(md).toContain('- Beta');
    });

    it('converts ordered lists', () => {
      const el = document.createElement('div');
      el.innerHTML = '<ol><li>First</li><li>Second</li></ol>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('1. First');
      expect(md).toContain('2. Second');
    });

    it('converts blockquotes', () => {
      const el = document.createElement('div');
      el.innerHTML = '<blockquote>A quote</blockquote>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('> A quote');
    });

    it('converts horizontal rules', () => {
      const el = document.createElement('div');
      el.innerHTML = '<hr>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('---');
    });

    it('converts checkboxes', () => {
      const el = document.createElement('div');
      el.innerHTML = '<ul><li><input type="checkbox" checked> Done</li><li><input type="checkbox"> Todo</li></ul>';
      const md = MarkdownHelper.toMarkdown(el);
      expect(md).toContain('[x]');
      expect(md).toContain('[ ]');
    });
  });

  describe('parseLine', () => {
    it('returns empty string for blank lines', () => {
      expect(MarkdownHelper.parseLine('')).toBe('');
      expect(MarkdownHelper.parseLine('   ')).toBe('');
    });

    it('parses headings at different levels', () => {
      expect(MarkdownHelper.parseLine('# H1')).toBe('<h1>H1</h1>');
      expect(MarkdownHelper.parseLine('## H2')).toBe('<h2>H2</h2>');
    });

    it('parses blockquotes', () => {
      const result = MarkdownHelper.parseLine('> Quote text');
      expect(result).toContain('<blockquote>');
    });

    it('wraps regular text in <p>', () => {
      const result = MarkdownHelper.parseLine('Just text');
      expect(result).toBe('<p>Just text</p>');
    });
  });

  describe('parseInline', () => {
    it('handles text with no formatting', () => {
      expect(MarkdownHelper.parseInline('plain text')).toBe('plain text');
    });

    it('handles multiple bold segments', () => {
      const result = MarkdownHelper.parseInline('**a** and **b**');
      expect(result).toContain('<strong>a</strong>');
      expect(result).toContain('<strong>b</strong>');
    });

    it('handles mixed bold and italic', () => {
      const result = MarkdownHelper.parseInline('**bold** *italic*');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });
  });
});
