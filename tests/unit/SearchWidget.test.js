import { describe, it, expect } from 'vitest';
import { SearchWidget } from '../../src/widgets/SearchWidget.js';

describe('SearchWidget', () => {
  describe('static metadata', () => {
    it('has correct metadata', () => {
      expect(SearchWidget.metadata.name).toBe('Search');
      expect(SearchWidget.metadata.icon).toBe('🔍');
      expect(SearchWidget.metadata.defaultSize).toEqual({ width: 4, height: 1 });
    });
  });

  describe('DEFAULT_URL_TEMPLATE', () => {
    it('is a Google search URL', () => {
      expect(SearchWidget.DEFAULT_URL_TEMPLATE).toContain('google.com/search');
      expect(SearchWidget.DEFAULT_URL_TEMPLATE).toContain('{query}');
    });
  });

  describe('constructor', () => {
    it('sets type to search', () => {
      const widget = new SearchWidget({ id: 's1', type: 'search', data: {} });
      expect(widget.type).toBe('search');
    });

    it('sets default urlTemplate when not provided', () => {
      const widget = new SearchWidget({ id: 's2', type: 'search', data: {} });
      expect(widget.data.urlTemplate).toBe(SearchWidget.DEFAULT_URL_TEMPLATE);
    });

    it('keeps custom urlTemplate when provided', () => {
      const widget = new SearchWidget({
        id: 's3', type: 'search', data: { urlTemplate: 'https://bing.com/?q={query}' }
      });
      expect(widget.data.urlTemplate).toBe('https://bing.com/?q={query}');
    });
  });

  describe('getConfigSchema', () => {
    it('returns urlTemplate and placeholder fields', () => {
      const widget = new SearchWidget({ id: 's4', type: 'search', data: {} });
      const schema = widget.getConfigSchema();
      expect(schema).toHaveLength(2);

      const urlField = schema.find(f => f.key === 'urlTemplate');
      expect(urlField).toBeDefined();
      expect(urlField.type).toBe('string');

      const placeholderField = schema.find(f => f.key === 'placeholder');
      expect(placeholderField).toBeDefined();
      expect(placeholderField.type).toBe('string');
    });
  });

  describe('getContent', () => {
    it('renders a search input', () => {
      const widget = new SearchWidget({ id: 's5', type: 'search', data: {} });
      const html = widget.getContent();
      expect(html).toContain('<input');
      expect(html).toContain('search-input');
    });

    it('uses custom placeholder', () => {
      const widget = new SearchWidget({
        id: 's6', type: 'search', data: { placeholder: 'Search code...' }
      });
      const html = widget.getContent();
      expect(html).toContain('Search code...');
    });

    it('uses default placeholder when not set', () => {
      const widget = new SearchWidget({ id: 's7', type: 'search', data: {} });
      const html = widget.getContent();
      expect(html).toContain('Search the web...');
    });
  });
});
