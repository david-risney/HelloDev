// HelloDev Dashboard - Default widget layout for new users

/**
 * Default widget configurations shown when a user first loads the dashboard
 * or when saved state is incompatible/corrupt.
 *
 * Each entry should specify: id, type, x, y, width, height, and optionally data.
 */
export const DEFAULT_WIDGETS = [
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
];
