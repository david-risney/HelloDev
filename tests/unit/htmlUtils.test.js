import { describe, it, expect } from 'vitest';
import { escapeHtml, rawHtml, safeHtml } from '../../src/htmlUtils.js';

describe('htmlUtils', () => {
  describe('escapeHtml', () => {
    it('escapes angle brackets', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes ampersands', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('passes through quotes (textContent does not escape them)', () => {
      // The escapeHtml implementation uses textContent/innerHTML which
      // escapes <, >, & but not quotes. This is safe for element content.
      const result = escapeHtml('"hello"');
      expect(result).toBe('"hello"');
    });

    it('handles null and undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('converts numbers to string', () => {
      expect(escapeHtml(42)).toBe('42');
    });

    it('returns empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('leaves safe strings unchanged', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('handles XSS payloads', () => {
      const xss = '<img src=x onerror=alert(1)>';
      const escaped = escapeHtml(xss);
      expect(escaped).not.toContain('<img');
      expect(escaped).toContain('&lt;img');
    });
  });

  describe('rawHtml', () => {
    it('wraps value as safe HTML', () => {
      const result = rawHtml('<b>bold</b>');
      expect(result.value).toBe('<b>bold</b>');
    });

    it('converts non-string values to string', () => {
      const result = rawHtml(42);
      expect(result.value).toBe('42');
    });
  });

  describe('safeHtml', () => {
    it('returns static strings unchanged', () => {
      const result = safeHtml`<div>hello</div>`;
      expect(result).toBe('<div>hello</div>');
    });

    it('escapes interpolated values', () => {
      const userInput = '<script>alert("xss")</script>';
      const result = safeHtml`<span>${userInput}</span>`;
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('<span>');
    });

    it('does not escape rawHtml values', () => {
      const trusted = rawHtml('<b>bold</b>');
      const result = safeHtml`<div>${trusted}</div>`;
      expect(result).toBe('<div><b>bold</b></div>');
    });

    it('mixes escaped and raw values', () => {
      const untrusted = '<script>bad</script>';
      const trusted = rawHtml('<em>safe</em>');
      const result = safeHtml`<div>${untrusted} ${trusted}</div>`;
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('<em>safe</em>');
    });

    it('escapes null and undefined interpolations', () => {
      const result = safeHtml`<span>${null}</span>`;
      expect(result).toBe('<span></span>');
    });
  });
});
