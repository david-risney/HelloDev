import { describe, it, expect } from 'vitest';
import { WidgetBase } from '../../src/widgets/WidgetBase.js';

describe('WidgetBase', () => {
  const baseConfig = {
    id: 'test-widget-1',
    type: 'test',
    x: 2,
    y: 3,
    width: 4,
    height: 5,
    zIndex: 10,
    stretchFill: false,
    data: { foo: 'bar' }
  };

  describe('constructor', () => {
    it('sets all properties from config', () => {
      const widget = new WidgetBase(baseConfig);
      expect(widget.id).toBe('test-widget-1');
      expect(widget.type).toBe('test');
      expect(widget.x).toBe(2);
      expect(widget.y).toBe(3);
      expect(widget.width).toBe(4);
      expect(widget.height).toBe(5);
      expect(widget.zIndex).toBe(10);
      expect(widget.stretchFill).toBe(false);
      expect(widget.data).toEqual({ foo: 'bar' });
    });

    it('applies defaults for missing optional properties', () => {
      const widget = new WidgetBase({ id: 'w1', type: 'test' });
      expect(widget.x).toBe(0);
      expect(widget.y).toBe(0);
      expect(widget.width).toBe(1);
      expect(widget.height).toBe(1);
      expect(widget.stretchFill).toBe(false);
      expect(widget.data).toEqual({});
    });
  });

  describe('toJSON', () => {
    it('serializes all properties', () => {
      const widget = new WidgetBase(baseConfig);
      const json = widget.toJSON();
      expect(json).toEqual({
        id: 'test-widget-1',
        type: 'test',
        x: 2,
        y: 3,
        width: 4,
        height: 5,
        zIndex: 10,
        stretchFill: false,
        data: { foo: 'bar' }
      });
    });

    it('round-trips through constructor', () => {
      const widget = new WidgetBase(baseConfig);
      const json = widget.toJSON();
      const restored = new WidgetBase(json);
      expect(restored.toJSON()).toEqual(json);
    });
  });

  describe('getConfigSchema / getConfig / setConfig / hasConfig', () => {
    it('base class has no config schema', () => {
      const widget = new WidgetBase(baseConfig);
      expect(widget.getConfigSchema()).toEqual([]);
      expect(widget.hasConfig()).toBe(false);
      expect(widget.getConfig()).toEqual({});
    });

    it('subclass with schema returns config values', () => {
      class TestWidget extends WidgetBase {
        getConfigSchema() {
          return [
            { key: 'title', label: 'Title', type: 'string', default: 'Untitled' },
            { key: 'count', label: 'Count', type: 'number', default: 5 }
          ];
        }
      }

      const widget = new TestWidget({
        id: 'w1', type: 'test', data: { title: 'Hello' }
      });

      expect(widget.hasConfig()).toBe(true);
      expect(widget.getConfig()).toEqual({ title: 'Hello', count: 5 });
    });

    it('setConfig only sets valid keys from schema', () => {
      class TestWidget extends WidgetBase {
        getConfigSchema() {
          return [
            { key: 'title', label: 'Title', type: 'string', default: '' }
          ];
        }
      }

      const widget = new TestWidget({ id: 'w1', type: 'test', data: {} });
      widget.setConfig({ title: 'Updated', invalid: 'ignored' });

      expect(widget.data.title).toBe('Updated');
      expect(widget.data.invalid).toBeUndefined();
    });
  });

  describe('getContent', () => {
    it('returns unknown widget message for base class', () => {
      const widget = new WidgetBase(baseConfig);
      expect(widget.getContent()).toContain('Unknown widget');
    });
  });

  describe('applyGridPosition', () => {
    it('sets CSS grid placement when stretchFill is false', () => {
      const widget = new WidgetBase({
        ...baseConfig, stretchFill: false, x: 1, y: 2, width: 3, height: 4
      });
      widget.element = document.createElement('div');
      widget.applyGridPosition();

      expect(widget.element.style.gridColumn).toBe('2 / span 3');
      expect(widget.element.style.gridRow).toBe('3 / span 4');
      expect(widget.element.classList.contains('widget-stretch-fill')).toBe(false);
    });

    it('adds stretch-fill class when stretchFill is true', () => {
      const widget = new WidgetBase({ ...baseConfig, stretchFill: true });
      widget.element = document.createElement('div');
      widget.applyGridPosition();

      expect(widget.element.classList.contains('widget-stretch-fill')).toBe(true);
    });

    it('does nothing when element is null', () => {
      const widget = new WidgetBase(baseConfig);
      // Should not throw
      expect(() => widget.applyGridPosition()).not.toThrow();
    });
  });

  describe('createElement', () => {
    it('creates a DOM element with correct class and data-id', () => {
      const widget = new WidgetBase(baseConfig);
      const removeWidget = () => {};
      const resizeWidget = () => {};
      const openWidgetConfig = () => {};

      const el = widget.createElement(removeWidget, resizeWidget, openWidgetConfig);

      expect(el.tagName).toBe('DIV');
      expect(el.classList.contains('widget')).toBe(true);
      expect(el.classList.contains('widget-test')).toBe(true);
      expect(el.dataset.id).toBe('test-widget-1');
    });

    it('contains control buttons', () => {
      const widget = new WidgetBase(baseConfig);
      const el = widget.createElement(() => {}, () => {}, () => {});

      expect(el.querySelector('.drag-handle')).not.toBeNull();
      expect(el.querySelector('.widget-control.minimize')).not.toBeNull();
      expect(el.querySelector('.widget-control.maximize')).not.toBeNull();
      expect(el.querySelector('.widget-control.config')).not.toBeNull();
      expect(el.querySelector('.resize-handle')).not.toBeNull();
    });

    it('contains widget content', () => {
      const widget = new WidgetBase(baseConfig);
      const el = widget.createElement(() => {}, () => {}, () => {});

      const content = el.querySelector('.widget-content');
      expect(content).not.toBeNull();
      expect(content.innerHTML).toContain('Unknown widget');
    });

    it('sets zIndex on the element', () => {
      const widget = new WidgetBase({ ...baseConfig, zIndex: 42 });
      const el = widget.createElement(() => {}, () => {}, () => {});
      expect(el.style.zIndex).toBe('42');
    });
  });

  describe('static metadata', () => {
    it('has default metadata', () => {
      expect(WidgetBase.metadata.name).toBe('Widget');
      expect(WidgetBase.metadata.icon).toBe('📦');
      expect(WidgetBase.metadata.defaultSize).toEqual({ width: 2, height: 2 });
    });
  });
});
