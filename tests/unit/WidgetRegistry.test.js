import { describe, it, expect } from 'vitest';
import { WidgetRegistry, createWidget, ClockWidget, SearchWidget, MarkdownWidget, WidgetBase } from '../../src/widgets/index.js';

describe('WidgetRegistry', () => {
  it('maps known type strings to widget classes', () => {
    expect(WidgetRegistry.clock).toBe(ClockWidget);
    expect(WidgetRegistry.search).toBe(SearchWidget);
    expect(WidgetRegistry.markdown).toBe(MarkdownWidget);
  });

  it('has entries for all registered widget types', () => {
    const expectedTypes = [
      'clock', 'search', 'markdown', 'adopr', 'adobugs',
      'frame', 'gerritcl', 'fluid', 'chromiumbug'
    ];
    for (const type of expectedTypes) {
      expect(WidgetRegistry).toHaveProperty(type);
      expect(typeof WidgetRegistry[type]).toBe('function');
    }
  });
});

describe('createWidget', () => {
  it('creates the correct widget subclass for a known type', () => {
    const widget = createWidget({
      id: 'test-1', type: 'clock', x: 0, y: 0, width: 3, height: 2, data: {}
    });
    expect(widget).toBeInstanceOf(ClockWidget);
    expect(widget.id).toBe('test-1');
  });

  it('creates a WidgetBase for an unknown type', () => {
    const widget = createWidget({
      id: 'test-2', type: 'nonexistent', x: 0, y: 0, width: 2, height: 2, data: {}
    });
    expect(widget).toBeInstanceOf(WidgetBase);
    expect(widget.type).toBe('nonexistent');
  });

  it('passes config through to the widget constructor', () => {
    const config = {
      id: 'test-3', type: 'search', x: 5, y: 10, width: 4, height: 1,
      zIndex: 3, stretchFill: true, data: { query: 'hello' }
    };
    const widget = createWidget(config);
    expect(widget.x).toBe(5);
    expect(widget.y).toBe(10);
    expect(widget.width).toBe(4);
    expect(widget.stretchFill).toBe(true);
  });
});
