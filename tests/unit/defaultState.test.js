import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../../src/defaultState.js';
import { STORAGE_VERSION } from '../../src/constants.js';

describe('defaultState', () => {
  it('has version matching STORAGE_VERSION', () => {
    expect(DEFAULT_STATE.version).toBe(STORAGE_VERSION);
  });

  it('has the required top-level keys', () => {
    expect(DEFAULT_STATE).toHaveProperty('version');
    expect(DEFAULT_STATE).toHaveProperty('widgets');
    expect(DEFAULT_STATE).toHaveProperty('colorPrimary');
    expect(DEFAULT_STATE).toHaveProperty('colorAccent');
    expect(DEFAULT_STATE).toHaveProperty('themeMode');
  });

  it('has widgets as a non-empty array', () => {
    expect(Array.isArray(DEFAULT_STATE.widgets)).toBe(true);
    expect(DEFAULT_STATE.widgets.length).toBeGreaterThan(0);
  });

  it('each widget has required properties', () => {
    for (const widget of DEFAULT_STATE.widgets) {
      expect(widget).toHaveProperty('id');
      expect(widget).toHaveProperty('type');
      expect(typeof widget.id).toBe('string');
      expect(typeof widget.type).toBe('string');
      expect(widget).toHaveProperty('x');
      expect(widget).toHaveProperty('y');
      expect(widget).toHaveProperty('width');
      expect(widget).toHaveProperty('height');
    }
  });

  it('widget ids are unique', () => {
    const ids = DEFAULT_STATE.widgets.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('theme colors are valid CSS color strings', () => {
    expect(DEFAULT_STATE.colorPrimary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(DEFAULT_STATE.colorAccent).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('themeMode is a valid value', () => {
    expect(['auto', 'light', 'dark']).toContain(DEFAULT_STATE.themeMode);
  });
});
