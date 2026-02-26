import { describe, it, expect } from 'vitest';
import { getThemeModeDisplay, getNextThemeMode, applyTheme } from '../../src/theme.js';

describe('theme', () => {
  describe('getThemeModeDisplay', () => {
    it('returns auto display for "auto"', () => {
      expect(getThemeModeDisplay('auto')).toContain('Auto');
    });

    it('returns light display for "light"', () => {
      expect(getThemeModeDisplay('light')).toContain('Light');
    });

    it('returns dark display for "dark"', () => {
      expect(getThemeModeDisplay('dark')).toContain('Dark');
    });

    it('defaults to auto for unknown mode', () => {
      expect(getThemeModeDisplay('invalid')).toContain('Auto');
      expect(getThemeModeDisplay(undefined)).toContain('Auto');
    });
  });

  describe('getNextThemeMode', () => {
    it('cycles auto -> light', () => {
      expect(getNextThemeMode('auto')).toBe('light');
    });

    it('cycles light -> dark', () => {
      expect(getNextThemeMode('light')).toBe('dark');
    });

    it('cycles dark -> auto', () => {
      expect(getNextThemeMode('dark')).toBe('auto');
    });

    it('treats unknown mode as auto (index -1 → cycles to 0)', () => {
      // (-1 + 1) % 3 === 0 → 'auto'
      expect(getNextThemeMode('invalid')).toBe('auto');
    });
  });

  describe('applyTheme', () => {
    it('sets CSS custom properties on documentElement', () => {
      const theme = { colorPrimary: '#ff0000', colorAccent: '#00ff00' };
      applyTheme(theme, 'dark');

      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#ff0000');
      expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#00ff00');
    });

    it('adds light-mode class when mode is "light"', () => {
      applyTheme({ colorPrimary: '#000', colorAccent: '#000' }, 'light');
      expect(document.body.classList.contains('light-mode')).toBe(true);
    });

    it('removes light-mode class when mode is "dark"', () => {
      document.body.classList.add('light-mode');
      applyTheme({ colorPrimary: '#000', colorAccent: '#000' }, 'dark');
      expect(document.body.classList.contains('light-mode')).toBe(false);
    });
  });
});
