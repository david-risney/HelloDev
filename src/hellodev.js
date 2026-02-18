// HelloDev Dashboard - Main orchestrator

import { createWidget, WidgetRegistry } from './widgets/index.js';
import { STORAGE_KEY, STORAGE_VERSION, DEFAULT_THEME, GRID_CELL_SIZE, GRID_GAP, DASHBOARD_PADDING } from './constants.js';
import { setupWidgetDrag } from './dragDrop.js';
import { openWidgetConfig as openWidgetConfigDialog, setupWidgetConfigDelegation } from './widgetConfig.js';
import { loadTheme } from './theme.js';
import {
  initFlyouts,
  closeAllFlyouts,
  showAddWidgetFlyout,
  showCustomizeFlyout,
  showAboutFlyout,
  showDataFlyout
} from './flyouts.js';

// ============================================================================
// Default Layout & State
// ============================================================================

const DEFAULT_WIDGETS = [
  { id: 'widget-1', type: 'clock', x: 0, y: 0, width: 3, height: 2 },
  {
    id: 'widget-2',
    type: 'markdown',
    x: 4,
    y: 1,
    width: 5,
    height: 4,
    data: {
      markdown: `# Welcome to HelloDev! \ud83d\udc4b

Your personal developer dashboard is ready to customize.

## Getting Started

- [ ] **Click the \u2630 menu** in the top-right to enter edit mode
- [ ] **Add widgets** from the panel that appears
- [ ] **Drag and resize widgets** to arrange your layout
- [ ] **Configure widgets** by clicking \u2699 on each one
- [ ] *Delete this widget when you're ready!*`
    }
  }
];

// Centralized dashboard state
const state = {
  widgets: [],
  editMode: false,
  themeMode: 'auto',
  draggingWidget: null,
  currentTheme: { ...DEFAULT_THEME }
};

// ============================================================================
// DOM References
// ============================================================================

const dashboard = document.getElementById('dashboard');
const editToggle = document.getElementById('editToggle');
const addWidgetBtn = document.getElementById('addWidgetBtn');
const customizeBtn = document.getElementById('customizeBtn');
const dataBtn = document.getElementById('dataBtn');
const aboutBtn = document.getElementById('aboutBtn');

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', init);

function init() {
  initFlyouts({ addWidgetBtn, customizeBtn, dataBtn, aboutBtn });
  loadTheme(state);
  loadWidgets();
  renderDashboard();
  setupEventListeners();
  setupWidgetConfigDelegation();
}

// ============================================================================
// Widget Persistence
// ============================================================================

// Show a transient error toast for storage failures
function showStorageError(message) {
  // Remove any existing error toast
  const existing = document.querySelector('.storage-error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'storage-error-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Auto-dismiss after 5 seconds
  setTimeout(() => toast.remove(), 5000);
}

function loadWidgets() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let configs = [];

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && 'version' in parsed) {
        if (parsed.version === STORAGE_VERSION) {
          configs = parsed.widgets || [];
        } else {
          console.warn(`Incompatible saved state version ${parsed.version}, expected ${STORAGE_VERSION}. Using defaults.`);
          configs = [...DEFAULT_WIDGETS];
        }
      } else {
        configs = [...DEFAULT_WIDGETS];
      }
    } catch (e) {
      console.error('Failed to load widgets:', e);
      showStorageError('Could not load saved dashboard. Using defaults.');
      configs = [...DEFAULT_WIDGETS];
    }
  } else {
    configs = [...DEFAULT_WIDGETS];
  }

  state.widgets = configs.map(config => {
    const widget = createWidget(config);
    if (widget.saveWidgets !== undefined) {
      widget.saveWidgets = saveWidgets;
    }
    return widget;
  });
}

// Debounced save to avoid redundant writes during rapid operations
const saveWidgets = (() => {
  let timeoutId = null;

  function doSave() {
    const configs = state.widgets.map(w => w.toJSON());
    const payload = {
      version: STORAGE_VERSION,
      widgets: configs
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save widgets:', e);
      showStorageError('Could not save your dashboard. Storage may be full or unavailable.');
    }
  }

  function save() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      doSave();
    }, 200);
  }

  save.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      doSave();
    }
  };

  return save;
})();

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
  editToggle.addEventListener('click', toggleEditMode);

  dashboard.addEventListener('widget-changed', () => {
    saveWidgets();
  });

  addWidgetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('addWidgetFlyout')) {
      closeAllFlyouts();
    } else {
      showAddWidgetFlyout(addWidget);
    }
  });

  customizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('customizeFlyout')) {
      closeAllFlyouts();
    } else {
      showCustomizeFlyout(state);
    }
  });

  dataBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('dataFlyout')) {
      closeAllFlyouts();
    } else {
      showDataFlyout();
    }
  });

  aboutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('aboutFlyout')) {
      closeAllFlyouts();
    } else {
      showAboutFlyout();
    }
  });
}

// ============================================================================
// Edit Mode
// ============================================================================

function toggleEditMode() {
  state.editMode = !state.editMode;
  editToggle.classList.toggle('active', state.editMode);
  editToggle.querySelector('.edit-icon').textContent = state.editMode ? '\u2716' : '\u2630';
  editToggle.title = state.editMode ? 'Done' : 'Menu';
  dashboard.classList.toggle('edit-mode', state.editMode);

  addWidgetBtn.classList.toggle('visible', state.editMode);
  customizeBtn.classList.toggle('visible', state.editMode);
  dataBtn.classList.toggle('visible', state.editMode);
  aboutBtn.classList.toggle('visible', state.editMode);

  if (!state.editMode) {
    closeAllFlyouts();
  }
}

// ============================================================================
// Dashboard Rendering
// ============================================================================

function renderDashboard() {
  dashboard.innerHTML = '';

  if (state.widgets.length === 0) {
    dashboard.innerHTML = `
      <div class="dashboard-empty">
        <div class="dashboard-empty-icon">\ud83d\udce6</div>
        <p>No widgets yet. Click Edit to add some!</p>
      </div>
    `;
    return;
  }

  state.widgets.forEach(widget => {
    const el = widget.createElement(removeWidget, resizeWidget, openWidgetConfig);
    const dragHandle = el.querySelector('.widget-control.drag-handle');
    setupWidgetDrag(dragHandle, el, widget, dashboard, state, moveWidget);
    dashboard.appendChild(el);
  });

  // Recalculate stretch-fill widgets now that elements are in the DOM
  updateStretchFillWidgets();
}

// ============================================================================
// Widget Management
// ============================================================================

function moveWidget(id, newX, newY) {
  const widget = state.widgets.find(w => w.id === id);
  if (widget) {
    widget.x = newX;
    widget.y = newY;
    saveWidgets();
    renderDashboard();
  }
}

function findNextPosition(newWidth, newHeight, newZIndex) {
  // Only consider widgets at the same or higher z-index
  const relevant = state.widgets.filter(w => !w.stretchFill && w.zIndex >= newZIndex);

  // Determine how many grid columns fit in the current dashboard width
  const dashWidth = dashboard.clientWidth - DASHBOARD_PADDING * 2;
  const maxCols = Math.max(1, Math.floor((dashWidth + GRID_GAP) / (GRID_CELL_SIZE + GRID_GAP)));

  if (relevant.length === 0) return { x: 0, y: 0 };

  // Scan rows top-to-bottom; find the first row where the new widget fits
  const maxRow = Math.max(...relevant.map(w => w.y + w.height));

  for (let row = 0; row <= maxRow; row++) {
    let rightEdge = 0;
    for (const w of relevant) {
      // Widget occupies rows w.y .. w.y+w.height-1
      if (w.y < row + newHeight && w.y + w.height > row) {
        const right = w.x + w.width;
        if (right > rightEdge) rightEdge = right;
      }
    }
    // Check if the new widget fits in this row
    if (rightEdge + newWidth <= maxCols) {
      return { x: rightEdge, y: row };
    }
  }

  // No row has space — place below everything
  return { x: 0, y: maxRow };
}

function addWidget(type) {
  const id = `widget-${Date.now()}`;
  const WidgetClass = WidgetRegistry[type];

  const existingWidgetsOfType = state.widgets.filter(w => w.type === type);
  const existingWidget = existingWidgetsOfType.length > 0
    ? existingWidgetsOfType[existingWidgetsOfType.length - 1]
    : null;

  let width, height, data;
  if (existingWidget) {
    width = existingWidget.width;
    height = existingWidget.height;
    data = structuredClone(existingWidget.data);
  } else {
    const defaultSize = WidgetClass?.metadata?.defaultSize || { width: 2, height: 2 };
    width = defaultSize.width;
    height = defaultSize.height;
    data = {};
  }

  const newZIndex = WidgetClass?.metadata?.defaultZIndex ?? 2;
  const pos = findNextPosition(width, height, newZIndex);

  const config = { id, type, x: pos.x, y: pos.y, width, height, data };
  const newWidget = createWidget(config);
  if (newWidget.saveWidgets !== undefined) {
    newWidget.saveWidgets = saveWidgets;
  }
  state.widgets.push(newWidget);
  saveWidgets();
  renderDashboard();
}

function removeWidget(id) {
  const widget = state.widgets.find(w => w.id === id);
  if (widget && widget.destroy) {
    widget.destroy();
  }
  state.widgets = state.widgets.filter(w => w.id !== id);
  saveWidgets();
  renderDashboard();
}

function resizeWidget(id, newWidth, newHeight) {
  const widget = state.widgets.find(w => w.id === id);
  if (widget) {
    widget.width = newWidth;
    widget.height = newHeight;
    saveWidgets();
    renderDashboard();
  }
}

// Recalculate grid placement for all stretch-fill widgets
function updateStretchFillWidgets() {
  for (const widget of state.widgets) {
    if (widget.stretchFill && widget.element) {
      widget.applyGridPosition();
    }
  }
}

// Watch for dashboard size changes to update stretch-fill widgets
const dashboardResizeObserver = new ResizeObserver(() => {
  updateStretchFillWidgets();
});
dashboardResizeObserver.observe(dashboard);

function openWidgetConfig(id) {
  const widget = state.widgets.find(w => w.id === id);
  if (!widget) return;
  openWidgetConfigDialog(widget, { removeWidget, saveWidgets, renderDashboard, widgets: state.widgets, openWidgetConfig });
}
