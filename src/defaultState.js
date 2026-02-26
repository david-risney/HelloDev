// HelloDev Dashboard - Default state for new users

import { STORAGE_VERSION } from './constants.js';

/**
 * Default dashboard state shown when a user first loads the dashboard
 * or when saved state is incompatible/corrupt.
 *
 * This is the canonical shape used everywhere: localStorage, chrome.storage.sync,
 * file export/import, and the DEFAULT_STATE constant itself.
 *
 * Shape:
 *   version      - state format version (must match STORAGE_VERSION)
 *   widgets      - array of widget configs (id, type, x, y, width, height, ...)
 *   colorPrimary - CSS color for the primary/background theme color
 *   colorAccent  - CSS color for the accent/highlight color
 *   themeMode    - 'auto' | 'light' | 'dark'
 */
export const DEFAULT_STATE = {
  version: STORAGE_VERSION,
  widgets: [
  {
    id: 'widget-default-1',
    type: 'fluid',
    x: 8,
    y: 0,
    width: 3,
    height: 3,
    zIndex: 0,
    stretchFill: true,
    data: {}
  },
  {
    id: 'widget-default-2',
    type: 'clock',
    x: 8,
    y: 0,
    width: 3,
    height: 2,
    zIndex: 1,
    stretchFill: true,
    data: {
      name: '',
      style: 'Classic'
    }
  },
  {
    id: 'widget-default-3',
    type: 'markdown',
    x: 1,
    y: 1,
    width: 6,
    height: 5,
    zIndex: 2,
    stretchFill: false,
    data: {
      markdown: `# Welcome to HelloDev! \ud83d\udc4b

Your personal developer dashboard is ready to customize.

## Getting Started

- [ ] **Click the \u2630 menu** in the top-right to enter edit mode
- [ ] **Add widgets** from the panel that appears
- [ ] **Drag and resize widgets** to arrange your layout
- [ ] **Configure widgets** by clicking \u2699 on each one
- [ ] *Delete this widget when you're ready!*`,
      viewMode: 'rendered'
    }
  }
  ],
  colorPrimary: '#1a1a2e',
  colorAccent: '#667eea',
  themeMode: 'auto'
};
