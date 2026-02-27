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
    id: 'widget-default-md',
    type: 'markdown',
    x: 1,
    y: 1,
    width: 6,
    height: 5,
    zIndex: 2,
    stretchFill: false,
    data: {
      markdown: `# Hello from HelloDev \ud83d\udc4b

## Get Started!

- [ ] Use the **[\u2630 menu](#action=edit)** in the top-right to enter edit mode
- [ ] Add **packs** of widgets: [ADO](#action=add&name=ADO+Dev), [Chromium](#action=add&name=Chromium+Dev), [GitHub](#action=add&name=GitHub+Dev)
- [ ] Or **[add widgets](#action=add)** one off with the \u2795 button
- [ ] Each widget can be moved \u2725, resized \u2922 and configured \u2699
- [ ] Personalize your dashboard **[appearance](#action=appearance)**
- [ ] *[Delete this widget](#action=configure&id=widget-default-md) whenever!*`,
      viewMode: 'rendered'
    }
  }
  ],
  colorPrimary: '#1a1a2e',
  colorAccent: '#667eea',
  themeMode: 'auto'
};
