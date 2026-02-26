// Theme management for HelloDev dashboard

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

// Save theme to state and apply it (persistence is handled by the unified save in hellodev.js)
export function saveTheme(state, theme) {
  state.currentTheme = theme;
  state.themeMode = theme.themeMode || 'auto';
  applyTheme(theme, state.themeMode);
}

// Apply theme from state (called during init after unified state is loaded)
export function loadTheme(state) {
  applyTheme(state.currentTheme, state.themeMode);

  // Listen for OS theme changes when in auto mode
  osPrefersDark.addEventListener('change', () => {
    if (state.themeMode === 'auto') {
      applyTheme(state.currentTheme, state.themeMode);
    }
  });
}
