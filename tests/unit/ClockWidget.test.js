import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClockWidget } from '../../src/widgets/ClockWidget.js';

describe('ClockWidget', () => {
  let widget;

  beforeEach(() => {
    vi.useFakeTimers();
    widget = new ClockWidget({
      id: 'clock-1', type: 'clock', x: 0, y: 0, width: 3, height: 2,
      data: { name: '', style: 'Classic' }
    });
  });

  afterEach(() => {
    widget.destroy();
    vi.useRealTimers();
  });

  describe('static metadata', () => {
    it('has correct metadata', () => {
      expect(ClockWidget.metadata.name).toBe('Clock');
      expect(ClockWidget.metadata.icon).toBe('🕐');
      expect(ClockWidget.metadata.defaultSize).toEqual({ width: 3, height: 2 });
    });
  });

  describe('getConfigSchema', () => {
    it('returns name and style fields', () => {
      const schema = widget.getConfigSchema();
      expect(schema.length).toBe(2);

      const nameField = schema.find(f => f.key === 'name');
      expect(nameField).toBeDefined();
      expect(nameField.type).toBe('string');

      const styleField = schema.find(f => f.key === 'style');
      expect(styleField).toBeDefined();
      expect(styleField.type).toBe('select');
      expect(styleField.options).toContain('Classic');
      expect(styleField.options).toContain('Analog');
    });
  });

  describe('getContent', () => {
    it('returns classic clock HTML by default', () => {
      const content = widget.getContent();
      expect(content).toContain('clock-display');
      expect(content).toContain('style-classic');
      expect(content).toContain('greeting');
      expect(content).toContain('clock-time');
      expect(content).toContain('clock-date');
    });

    it('returns analog clock HTML for analog style', () => {
      widget.data.style = 'Analog';
      const content = widget.getContent();
      expect(content).toContain('style-analog');
      expect(content).toContain('analog-clock');
      expect(content).toContain('hour-hand');
      expect(content).toContain('minute-hand');
    });

    it('returns modern clock HTML for modern style', () => {
      widget.data.style = 'Modern';
      const content = widget.getContent();
      expect(content).toContain('style-modern');
      expect(content).toContain('flux-face');
    });
  });

  describe('greeting logic', () => {
    function createAndUpdate(hour) {
      vi.setSystemTime(new Date(2026, 1, 26, hour, 0, 0));
      const w = new ClockWidget({
        id: 'greet-test', type: 'clock', x: 0, y: 0, width: 3, height: 2,
        data: { name: '', style: 'Classic' }
      });
      const el = w.createElement(() => {}, () => {}, () => {});
      w.updateClock();
      const greetingEl = el.querySelector('.greeting');
      const text = greetingEl?.textContent || '';
      w.destroy();
      return text;
    }

    it('shows "Good Morning" before noon', () => {
      expect(createAndUpdate(8)).toBe('Good Morning!');
      expect(createAndUpdate(0)).toBe('Good Morning!');
      expect(createAndUpdate(11)).toBe('Good Morning!');
    });

    it('shows "Good Afternoon" from noon to 6pm', () => {
      expect(createAndUpdate(12)).toBe('Good Afternoon!');
      expect(createAndUpdate(15)).toBe('Good Afternoon!');
      expect(createAndUpdate(17)).toBe('Good Afternoon!');
    });

    it('shows "Good Evening" from 6pm onward', () => {
      expect(createAndUpdate(18)).toBe('Good Evening!');
      expect(createAndUpdate(21)).toBe('Good Evening!');
      expect(createAndUpdate(23)).toBe('Good Evening!');
    });

    it('includes name in greeting when set', () => {
      vi.setSystemTime(new Date(2026, 1, 26, 9, 0, 0));
      const w = new ClockWidget({
        id: 'greet-name', type: 'clock', x: 0, y: 0, width: 3, height: 2,
        data: { name: 'Alice', style: 'Classic' }
      });
      const el = w.createElement(() => {}, () => {}, () => {});
      w.updateClock();
      const greeting = el.querySelector('.greeting').textContent;
      expect(greeting).toBe('Good Morning, Alice!');
      w.destroy();
    });
  });

  describe('7-segment patterns', () => {
    it('has patterns for all digits 0-9', () => {
      for (let i = 0; i <= 9; i++) {
        const pattern = ClockWidget.SEGMENT_PATTERNS[String(i)];
        expect(pattern).toBeDefined();
        expect(pattern).toHaveLength(7);
        expect(pattern.every(v => v === 0 || v === 1)).toBe(true);
      }
    });
  });

  describe('createSegmentDigit', () => {
    it('creates colon element for ":"', () => {
      const html = widget.createSegmentDigit(':');
      expect(html).toContain('seg-colon');
    });

    it('creates segment digit for a number', () => {
      const html = widget.createSegmentDigit('0');
      expect(html).toContain('seg-digit');
      expect(html).toContain('seg-a');
    });
  });

  describe('destroy', () => {
    it('clears interval and resize observer', () => {
      const el = widget.createElement(() => {}, () => {}, () => {});
      widget.setupBehavior(el);

      expect(widget.intervalId).not.toBeNull();
      expect(widget.resizeObserver).not.toBeNull();

      widget.destroy();

      expect(widget.intervalId).toBeNull();
      expect(widget.resizeObserver).toBeNull();
    });
  });
});
