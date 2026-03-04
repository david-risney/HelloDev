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

    it('creates default searchTemplates when not provided', () => {
      const widget = new SearchWidget({ id: 's2', type: 'search', data: {} });
      expect(widget.data.searchTemplates).toHaveLength(1);
      expect(widget.data.searchTemplates[0].urlTemplate).toBe(SearchWidget.DEFAULT_URL_TEMPLATE);
      expect(widget.data.activeTemplate).toBe(0);
    });

    it('migrates legacy urlTemplate to searchTemplates', () => {
      const widget = new SearchWidget({
        id: 's3', type: 'search', data: { urlTemplate: 'https://bing.com/?q={query}', placeholder: 'Bing it!' }
      });
      expect(widget.data.searchTemplates).toHaveLength(1);
      expect(widget.data.searchTemplates[0].urlTemplate).toBe('https://bing.com/?q={query}');
      expect(widget.data.searchTemplates[0].placeholder).toBe('Bing it!');
      expect(widget.data.urlTemplate).toBeUndefined();
      expect(widget.data.placeholder).toBeUndefined();
    });

    it('keeps custom searchTemplates when provided', () => {
      const templates = [
        { name: 'Google', urlTemplate: 'https://google.com/search?q={query}', placeholder: 'Google...' },
        { name: 'Bing', urlTemplate: 'https://bing.com/?q={query}', placeholder: 'Bing...' }
      ];
      const widget = new SearchWidget({ id: 's4', type: 'search', data: { searchTemplates: templates } });
      expect(widget.data.searchTemplates).toHaveLength(2);
      expect(widget.data.searchTemplates[0].name).toBe('Google');
      expect(widget.data.searchTemplates[1].name).toBe('Bing');
    });
  });

  describe('getConfigSchema', () => {
    it('returns searchTemplates list field', () => {
      const widget = new SearchWidget({ id: 's5', type: 'search', data: {} });
      const schema = widget.getConfigSchema();
      expect(schema).toHaveLength(1);

      const templatesField = schema.find(f => f.key === 'searchTemplates');
      expect(templatesField).toBeDefined();
      expect(templatesField.type).toBe('list');
      expect(templatesField.fields).toHaveLength(3);
      expect(templatesField.fields.map(f => f.key)).toEqual(['name', 'urlTemplate', 'placeholder']);
    });
  });

  describe('getContent', () => {
    it('renders a search input', () => {
      const widget = new SearchWidget({ id: 's6', type: 'search', data: {} });
      const html = widget.getContent();
      expect(html).toContain('<input');
      expect(html).toContain('search-input');
    });

    it('uses active template placeholder', () => {
      const widget = new SearchWidget({
        id: 's7', type: 'search',
        data: { searchTemplates: [{ name: 'Code', urlTemplate: 'https://example.com?q={query}', placeholder: 'Search code...' }] }
      });
      const html = widget.getContent();
      expect(html).toContain('Search code...');
    });

    it('uses default placeholder when template has none', () => {
      const widget = new SearchWidget({
        id: 's8', type: 'search',
        data: { searchTemplates: [{ name: 'Test', urlTemplate: 'https://example.com?q={query}', placeholder: '' }] }
      });
      const html = widget.getContent();
      expect(html).toContain('Search the web...');
    });

    it('does not show dropdown for a single template', () => {
      const widget = new SearchWidget({ id: 's9', type: 'search', data: {} });
      const html = widget.getContent();
      expect(html).not.toContain('<select');
    });

    it('shows dropdown when multiple templates are configured', () => {
      const templates = [
        { name: 'Google', urlTemplate: 'https://google.com/search?q={query}', placeholder: 'Google...' },
        { name: 'Bing', urlTemplate: 'https://bing.com/?q={query}', placeholder: 'Bing...' }
      ];
      const widget = new SearchWidget({ id: 's10', type: 'search', data: { searchTemplates: templates } });
      const html = widget.getContent();
      expect(html).toContain('<select');
      expect(html).toContain('search-template-select');
      expect(html).toContain('Google');
      expect(html).toContain('Bing');
    });
  });

  describe('_activeTemplate', () => {
    it('returns the template at activeTemplate index', () => {
      const templates = [
        { name: 'A', urlTemplate: 'https://a.com?q={query}', placeholder: 'A' },
        { name: 'B', urlTemplate: 'https://b.com?q={query}', placeholder: 'B' }
      ];
      const widget = new SearchWidget({ id: 's11', type: 'search', data: { searchTemplates: templates, activeTemplate: 1 } });
      expect(widget._activeTemplate().name).toBe('B');
    });

    it('clamps out-of-bounds index', () => {
      const widget = new SearchWidget({ id: 's12', type: 'search', data: { searchTemplates: [{ name: 'Only', urlTemplate: 'https://only.com?q={query}', placeholder: '' }], activeTemplate: 99 } });
      expect(widget._activeTemplate().name).toBe('Only');
    });
  });
});
