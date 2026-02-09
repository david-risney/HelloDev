// Theme management for HelloDev dashboard

import { THEME_STORAGE_KEY, DEFAULT_THEME } from './constants.js';

const osPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

// Get effective light mode based on themeMode setting
function getEffectiveLightMode(themeMode) {
  if (themeMode === 'auto') {
    return !osPrefersDark.matches;
  }
  return themeMode === 'light';
}

// Get display text for theme mode button
export function getThemeModeDisplay(mode) {
  switch (mode) {
    case 'auto': return '\u2728 Auto';
    case 'light': return '\u2600 Light';
    case 'dark': return '\u263e Dark';
    default: return '\u2728 Auto';
  }
}

// Cycle to next theme mode
export function getNextThemeMode(current) {
  const modes = ['auto', 'light', 'dark'];
  const idx = modes.indexOf(current);
  return modes[(idx + 1) % modes.length];
}

// Apply theme colors to CSS custom properties
export function applyTheme(theme, themeMode) {
  document.documentElement.style.setProperty('--color-primary', theme.colorPrimary);
  document.documentElement.style.setProperty('--color-accent', theme.colorAccent);

  const isLight = getEffectiveLightMode(themeMode);
  document.body.classList.toggle('light-mode', isLight);
}

// Save theme to storage and apply it
export function saveTheme(state, theme) {
  state.currentTheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (e) {
    console.error('Failed to save theme:', e);
  }
  applyTheme(theme, state.themeMode);
}

// Load theme from storage and apply to state
export function loadTheme(state) {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  let theme = DEFAULT_THEME;

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Migrate old lightMode boolean to new themeMode
      if ('lightMode' in parsed && !('themeMode' in parsed)) {
        parsed.themeMode = parsed.lightMode ? 'light' : 'dark';
        delete parsed.lightMode;
      }
      theme = { ...DEFAULT_THEME, ...parsed };
    } catch (e) {
      theme = DEFAULT_THEME;
    }
  }

  state.currentTheme = theme;
  state.themeMode = theme.themeMode || 'auto';
  applyTheme(theme, state.themeMode);

  // Listen for OS theme changes when in auto mode
  osPrefersDark.addEventListener('change', () => {
    if (state.themeMode === 'auto') {
      applyTheme(state.currentTheme, state.themeMode);
    }
  });
}
