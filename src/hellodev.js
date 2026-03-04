// HelloDev Dashboard - Main orchestrator

import { createWidget, WidgetRegistry } from './widgets/index.js';
import { STORAGE_KEY, STORAGE_VERSION, THEME_STORAGE_KEY, DEFAULT_THEME, GRID_CELL_SIZE, GRID_GAP, DASHBOARD_PADDING } from './constants.js';
import { setupWidgetDrag } from './dragDrop.js';
import { openWidgetConfig as openWidgetConfigDialog, setupWidgetConfigDelegation } from './widgetConfig.js';
import { loadTheme } from './theme.js';
import {
  initFlyouts,
  closeAllFlyouts,
  showAddWidgetFlyout,
  showPackPromptFlyout,
  showCustomizeFlyout,
  showAboutFlyout,
  showDataFlyout,
  showSetupFlyout
} from './flyouts.js';
import { parseActionUrl, findPackByName } from './actionLinks.js';
import { DEFAULT_STATE } from './defaultState.js';
import { saveToSync, loadFromSync, onSyncChanged } from './syncStorage.js';

// ============================================================================
// Dashboard State
// ============================================================================

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
const setupBtn = document.getElementById('setupBtn');
const aboutBtn = document.getElementById('aboutBtn');

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
  initFlyouts({ addWidgetBtn, customizeBtn, dataBtn, setupBtn, aboutBtn });
  await loadDashboard();
  loadTheme(state);
  renderDashboard();
  setupEventListeners();
  setupWidgetConfigDelegation();

  // Handle action links (fragment URLs from markdown widgets)
  setupActionLinkHandler();

  // Probe native host and auto-open setup flyout if not installed
  checkNativeHostAndShowSetup();

  // Listen for state changes synced from other devices
  onSyncChanged((syncedState) => {
    applyLoadedState(syncedState);
    // Update localStorage to match
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedState));
    } catch (_) { /* best-effort */ }
    loadTheme(state);
    renderDashboard();
  });
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

// Apply a loaded state object to the in-memory state
function applyLoadedState(loaded) {
  state.widgets = (loaded.widgets || []).map(config => createWidget(config));
  state.currentTheme = {
    colorPrimary: loaded.colorPrimary || DEFAULT_STATE.colorPrimary,
    colorAccent: loaded.colorAccent || DEFAULT_STATE.colorAccent,
    themeMode: loaded.themeMode || DEFAULT_STATE.themeMode
  };
  state.themeMode = state.currentTheme.themeMode;
}

async function loadDashboard() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let loaded = null;

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && 'version' in parsed) {
        if (parsed.version === STORAGE_VERSION) {
          loaded = parsed;
        } else {
          console.warn(`Incompatible saved state version ${parsed.version}, expected ${STORAGE_VERSION}. Using defaults.`);
        }
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
      showStorageError('Could not load saved dashboard. Using defaults.');
    }
  } else {
    // No local data — try loading from sync storage (e.g. new device)
    loaded = await loadFromSync();
  }

  // Migrate legacy theme from separate storage key
  if (loaded && !('colorPrimary' in loaded)) {
    const legacyTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (legacyTheme) {
      try {
        const parsed = JSON.parse(legacyTheme);
        if ('lightMode' in parsed && !('themeMode' in parsed)) {
          parsed.themeMode = parsed.lightMode ? 'light' : 'dark';
        }
        loaded.colorPrimary = parsed.colorPrimary || DEFAULT_STATE.colorPrimary;
        loaded.colorAccent = parsed.colorAccent || DEFAULT_STATE.colorAccent;
        loaded.themeMode = parsed.themeMode || DEFAULT_STATE.themeMode;
      } catch (_) { /* ignore bad legacy data */ }
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }

  if (!loaded || !Array.isArray(loaded.widgets)) {
    loaded = { ...DEFAULT_STATE, widgets: [...DEFAULT_STATE.widgets] };
  }

  applyLoadedState(loaded);
}

// Debounced save to avoid redundant writes during rapid operations
const saveDashboard = (() => {
  let timeoutId = null;

  function doSave() {
    const payload = {
      version: STORAGE_VERSION,
      widgets: state.widgets.map(w => w.toJSON()),
      colorPrimary: state.currentTheme.colorPrimary,
      colorAccent: state.currentTheme.colorAccent,
      themeMode: state.themeMode
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save dashboard:', e);
      showStorageError('Could not save your dashboard. Storage may be full or unavailable.');
    }
    // Replicate to sync storage for cross-device sync
    saveToSync(payload);
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
// Action Links
// ============================================================================

// Handle #action=… fragment links clicked inside the dashboard (e.g. in markdown widgets).
// On new-tab pages navigation is blocked, so we intercept clicks on any anchor
// whose resolved URL contains an action fragment and handle it directly.
function setupActionLinkHandler() {
  document.documentElement.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    // Use the anchor element's parsed hash (works even when the browser
    // resolves the href to a full chrome-extension:// URL).
    const hash = link.hash;
    const parsed = parseActionUrl(hash);
    if (!parsed) return;

    e.preventDefault();
    e.stopPropagation();
    handleAction(parsed);
  });
}

function handleAction({ action, params }) {
  // Ensure edit mode is active so toolbar flyouts can attach
  if (!state.editMode) {
    toggleEditMode();
  }

  switch (action) {
    case 'add': {
      const name = params.get('name');
      const pack = findPackByName(name);
      if (pack) {
        // Exact pack match — jump straight to the pack prompt
        showPackPromptFlyout(pack, addWidgetPack);
      } else {
        // No exact pack match — open the add flyout with a pre-filled filter
        showAddWidgetFlyout(addWidget, addWidgetPack, { initialFilter: name || '' });
      }
      break;
    }
    case 'appearance':
      showCustomizeFlyout(state, { onThemeChanged: saveDashboard });
      break;
    case 'configure': {
      const id = params.get('id');
      if (id) {
        openWidgetConfig(id);
      }
      break;
    }
    case 'edit':
      // Edit mode is already activated above; nothing else to do.
      break;
    case 'setup':
      showSetupFlyout(setupBtn);
      break;
  }
}

// ============================================================================
// Native Host Detection
// ============================================================================

async function checkNativeHostAndShowSetup() {
  // Check if user previously completed or dismissed setup
  try {
    const stored = await chrome.storage.local.get('nativeHostSetupDismissed');
    if (stored.nativeHostSetupDismissed) return;
  } catch (_) { /* continue */ }

  // Probe the native host via the background service worker
  try {
    const result = await chrome.runtime.sendMessage({ type: 'PROBE_NATIVE_HOST' });
    if (result && result.installed) return; // Native host is installed, nothing to do
  } catch (_) {
    // If sendMessage fails, the extension context may not be ready; skip
    return;
  }

  // Native host is not installed — auto-open the setup flyout
  // Activate edit mode so toolbar buttons are visible
  if (!state.editMode) {
    toggleEditMode();
  }
  showSetupFlyout(setupBtn);
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
  editToggle.addEventListener('click', toggleEditMode);

  dashboard.addEventListener('widget-changed', () => {
    saveDashboard();
  });

  addWidgetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('addWidgetFlyout')) {
      closeAllFlyouts();
    } else {
      showAddWidgetFlyout(addWidget, addWidgetPack);
    }
  });

  customizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('customizeFlyout')) {
      closeAllFlyouts();
    } else {
      showCustomizeFlyout(state, { onThemeChanged: saveDashboard });
    }
  });

  dataBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('dataFlyout')) {
      closeAllFlyouts();
    } else {
      showDataFlyout({
        getExportData: () => {
          return {
            version: STORAGE_VERSION,
            widgets: state.widgets.map(w => w.toJSON()),
            colorPrimary: state.currentTheme.colorPrimary,
            colorAccent: state.currentTheme.colorAccent,
            themeMode: state.themeMode
          };
        },
        importData: (data) => {
          if (!data || typeof data !== 'object' || !Array.isArray(data.widgets)) {
            alert('Invalid dashboard file format.');
            return;
          }
          applyLoadedState(data);
          loadTheme(state);
          saveDashboard();
          renderDashboard();
        }
      });
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

  setupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('setupFlyout')) {
      closeAllFlyouts();
    } else {
      showSetupFlyout(setupBtn);
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
  setupBtn.classList.toggle('visible', state.editMode);
  aboutBtn.classList.toggle('visible', state.editMode);

  if (state.editMode) {
    // Restore any maximized widgets when entering edit mode
    for (const widget of state.widgets) {
      widget.restoreFromMaximize();
    }
  }

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
    saveDashboard();
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
  state.widgets.push(newWidget);
  saveDashboard();
  renderDashboard();
}

function addWidgetPack(widgetConfigs) {
  for (const cfg of widgetConfigs) {
    const id = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const WidgetClass = WidgetRegistry[cfg.type];
    const width = cfg.width ?? WidgetClass?.metadata?.defaultSize?.width ?? 2;
    const height = cfg.height ?? WidgetClass?.metadata?.defaultSize?.height ?? 2;
    const newZIndex = WidgetClass?.metadata?.defaultZIndex ?? 2;
    const pos = findNextPosition(width, height, newZIndex);
    const config = { id, type: cfg.type, x: pos.x, y: pos.y, width, height, data: cfg.data || {} };
    const newWidget = createWidget(config);
    state.widgets.push(newWidget);
  }
  saveDashboard();
  renderDashboard();
}

function removeWidget(id) {
  const widget = state.widgets.find(w => w.id === id);
  if (widget && widget.destroy) {
    widget.destroy();
  }
  state.widgets = state.widgets.filter(w => w.id !== id);
  saveDashboard();
  renderDashboard();
}

function resizeWidget(id, newWidth, newHeight) {
  const widget = state.widgets.find(w => w.id === id);
  if (widget) {
    widget.width = newWidth;
    widget.height = newHeight;
    widget.minimized = false;
    saveDashboard();
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
  openWidgetConfigDialog(widget, { removeWidget, saveDashboard, renderDashboard, widgets: state.widgets, openWidgetConfig });
}
