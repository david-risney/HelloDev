import { describe, it, expect } from 'vitest';
import {
  STORAGE_KEY,
  THEME_STORAGE_KEY,
  STORAGE_VERSION,
  GRID_CELL_SIZE,
  GRID_GAP,
  DASHBOARD_PADDING,
  DEFAULT_THEME
} from '../../src/constants.js';

describe('constants', () => {
  it('exports STORAGE_KEY as a non-empty string', () => {
    expect(typeof STORAGE_KEY).toBe('string');
    expect(STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it('exports THEME_STORAGE_KEY as a non-empty string', () => {
    expect(typeof THEME_STORAGE_KEY).toBe('string');
    expect(THEME_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it('exports STORAGE_VERSION as a positive integer', () => {
    expect(Number.isInteger(STORAGE_VERSION)).toBe(true);
    expect(STORAGE_VERSION).toBeGreaterThan(0);
  });

  it('exports grid layout constants as positive numbers', () => {
    expect(GRID_CELL_SIZE).toBeGreaterThan(0);
    expect(GRID_GAP).toBeGreaterThanOrEqual(0);
    expect(DASHBOARD_PADDING).toBeGreaterThan(0);
  });

  it('exports DEFAULT_THEME with required properties', () => {
    expect(DEFAULT_THEME).toHaveProperty('colorPrimary');
    expect(DEFAULT_THEME).toHaveProperty('colorAccent');
    expect(DEFAULT_THEME).toHaveProperty('themeMode');
    expect(['auto', 'light', 'dark']).toContain(DEFAULT_THEME.themeMode);
  });
});
