// Shared constants for HelloDev dashboard

export const STORAGE_KEY = 'hellodev-widgets';
export const THEME_STORAGE_KEY = 'hellodev-theme';

// Version number for saved widget state. Increment this when the saved state format
// changes in an incompatible manner that would break loading of previously saved data.
export const STORAGE_VERSION = 1;

// Grid layout constants (must stay in sync with CSS custom properties in hellodev.css)
export const GRID_CELL_SIZE = 80;  // --grid-cell-size
export const GRID_GAP = 8;        // --grid-gap
export const DASHBOARD_PADDING = 16; // .dashboard padding (1rem)

// Default theme colors
export const DEFAULT_THEME = {
  colorPrimary: '#1a1a2e',
  colorAccent: '#667eea',
  themeMode: 'auto' // 'auto', 'light', or 'dark'
};
