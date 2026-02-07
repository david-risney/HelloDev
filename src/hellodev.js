// HelloDev Dashboard

import { createWidget, WidgetRegistry } from './widgets/index.js';

const STORAGE_KEY = 'hellodev-widgets';
const THEME_STORAGE_KEY = 'hellodev-theme';

// Version number for saved widget state. Increment this when the saved state format
// changes in an incompatible manner that would break loading of previously saved data.
const STORAGE_VERSION = 1;

// Grid cell size in pixels
const GRID_CELL_SIZE = 80;

// Default theme colors
const DEFAULT_THEME = {
  colorPrimary: '#1a1a2e',
  colorAccent: '#667eea',
  themeMode: 'auto' // 'auto', 'light', or 'dark'
};

// ============================================================================
// Dashboard State & Logic
// ============================================================================

// Default widget configurations
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
      markdown: `# Welcome to HelloDev! 👋

Your personal developer dashboard is ready to customize.

## Getting Started

1. **Click the ⚙ button** in the top-right to enter edit mode
2. **Add widgets** from the panel that appears
3. **Drag and resize widgets** to arrange your layout
4. **Configure widgets** by clicking ⚙ on each one

*Delete this widget when you're ready!*`
    }
  }
];

// State
let widgets = [];
let editMode = false;
let themeMode = 'auto'; // 'auto', 'light', or 'dark'
let draggingWidget = null;

// Detect OS color scheme preference
const osPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

// Get effective light mode based on themeMode setting
function getEffectiveLightMode() {
  if (themeMode === 'auto') {
    return !osPrefersDark.matches;
  }
  return themeMode === 'light';
}

// Get display text for theme mode button
function getThemeModeDisplay(mode) {
  switch (mode) {
    case 'auto': return '✨ Auto';
    case 'light': return '☀ Light';
    case 'dark': return '☾ Dark';
    default: return '✨ Auto';
  }
}

// Cycle to next theme mode
function getNextThemeMode(current) {
  const modes = ['auto', 'light', 'dark'];
  const idx = modes.indexOf(current);
  return modes[(idx + 1) % modes.length];
}

// DOM elements
const dashboard = document.getElementById('dashboard');
const editToggle = document.getElementById('editToggle');
const addWidgetBtn = document.getElementById('addWidgetBtn');
const customizeBtn = document.getElementById('customizeBtn');

// Theme state
let currentTheme = { ...DEFAULT_THEME };

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadTheme();
  loadWidgets();
  renderDashboard();
  setupEventListeners();
  setupDashboardDragDrop();
}

// Load widgets from storage
function loadWidgets() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let configs = [];

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Check if stored data has version info (new format)
      if (parsed && typeof parsed === 'object' && 'version' in parsed) {
        // Verify compatible version
        if (parsed.version === STORAGE_VERSION) {
          configs = parsed.widgets || [];
        } else {
          // Incompatible version - use defaults
          console.warn(`Incompatible saved state version ${parsed.version}, expected ${STORAGE_VERSION}. Using defaults.`);
          configs = [...DEFAULT_WIDGETS];
        }
      } else {
        // Legacy format (array without version) - use defaults
        configs = [...DEFAULT_WIDGETS];
      }
    } catch (e) {
      configs = [...DEFAULT_WIDGETS];
    }
  } else {
    configs = [...DEFAULT_WIDGETS];
  }

  // Convert plain objects to widget instances
  widgets = configs.map(config => {
    const widget = createWidget(config);
    // Inject saveWidgets callback for widgets that need it
    if (widget.saveWidgets !== undefined) {
      widget.saveWidgets = saveWidgets;
    }
    return widget;
  });
}

// Save widgets to storage
function saveWidgets() {
  const configs = widgets.map(w => w.toJSON());
  const state = {
    version: STORAGE_VERSION,
    widgets: configs
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ============================================================================
// Theme Management
// ============================================================================

// Load theme from storage
function loadTheme() {
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

  currentTheme = theme;
  themeMode = theme.themeMode || 'auto';
  applyTheme(theme);
  
  // Listen for OS theme changes when in auto mode
  osPrefersDark.addEventListener('change', () => {
    if (themeMode === 'auto') {
      applyTheme(currentTheme);
    }
  });
}

// Apply theme colors to CSS custom properties
function applyTheme(theme) {
  document.documentElement.style.setProperty('--color-primary', theme.colorPrimary);
  document.documentElement.style.setProperty('--color-accent', theme.colorAccent);
  
  // Apply light/dark mode based on themeMode setting
  const isLight = getEffectiveLightMode();
  document.body.classList.toggle('light-mode', isLight);
}

// Save theme to storage
function saveTheme(theme) {
  currentTheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  applyTheme(theme);
}

// Show Add Widget flyout
function showAddWidgetFlyout() {
  closeAllFlyouts();
  
  const flyout = document.createElement('div');
  flyout.className = 'flyout';
  flyout.id = 'addWidgetFlyout';
  
  let widgetButtons = '';
  for (const [type, WidgetClass] of Object.entries(WidgetRegistry)) {
    const { name, icon } = WidgetClass.metadata;
    widgetButtons += `<button class="widget-option" data-widget="${type}">${icon} ${name}</button>`;
  }
  
  flyout.innerHTML = `
    <div class="flyout-dialog">
      <div class="flyout-header">
        <h3>Add Widget</h3>
        <button class="flyout-close" title="Close">✕</button>
      </div>
      <div class="flyout-content">
        <div class="widget-options-grid">
          ${widgetButtons}
        </div>
      </div>
    </div>
  `;
  
  addWidgetBtn.appendChild(flyout);
  
  // Close button
  flyout.querySelector('.flyout-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllFlyouts();
  });
  
  // Prevent clicks inside flyout from closing it
  flyout.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Widget buttons
  flyout.querySelectorAll('.widget-option').forEach(btn => {
    btn.addEventListener('click', () => {
      addWidget(btn.dataset.widget);
      closeAllFlyouts();
    });
  });
  
  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}

// Color presets
const COLOR_PRESETS = [
  { name: 'Default', primary: '#1a1a2e', accent: '#667eea' },
  { name: 'Ocean', primary: '#0a192f', accent: '#64ffda' },
  { name: 'Forest', primary: '#1a2f1a', accent: '#4ade80' },
  { name: 'Sunset', primary: '#2d1b3d', accent: '#f97316' },
  { name: 'Rose', primary: '#1f1f2e', accent: '#f43f5e' },
  { name: 'Lavender', primary: '#1e1b2e', accent: '#a78bfa' },
  { name: 'Coffee', primary: '#1c1410', accent: '#d4a574' },
  { name: 'Hotdog', primary: '#ffeb3b', accent: '#f44336' }
];

// Show Appearance flyout
function showCustomizeFlyout() {
  closeAllFlyouts();
  
  const flyout = document.createElement('div');
  flyout.className = 'flyout';
  flyout.id = 'customizeFlyout';
  
  const presetButtons = COLOR_PRESETS.map(preset => 
    `<button class="preset-btn" data-primary="${preset.primary}" data-accent="${preset.accent}" title="${preset.name}">
      <span class="preset-primary" style="background: ${preset.primary}"></span>
      <span class="preset-accent" style="background: ${preset.accent}"></span>
    </button>`
  ).join('');
  
  flyout.innerHTML = `
    <div class="flyout-dialog">
      <div class="flyout-header">
        <h3>Appearance</h3>
        <button class="flyout-close" title="Close">✕</button>
      </div>
      <div class="flyout-content">
        <div class="customize-section">
          <div class="customize-label">Presets</div>
          <div class="presets-grid">
            ${presetButtons}
          </div>
        </div>
        <div class="customize-section">
          <div class="customize-label">Custom Colors</div>
          <div class="customize-row">
            <span>Primary</span>
            <input type="color" id="flyoutColorPrimary" value="${currentTheme.colorPrimary}">
          </div>
          <div class="customize-row">
            <span>Accent</span>
            <input type="color" id="flyoutColorAccent" value="${currentTheme.colorAccent}">
          </div>
        </div>
        <div class="customize-section">
          <div class="customize-row">
            <span>Theme</span>
            <button class="toggle-btn" id="flyoutThemeModeToggle">
              ${getThemeModeDisplay(themeMode)}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  customizeBtn.appendChild(flyout);
  
  const primaryInput = flyout.querySelector('#flyoutColorPrimary');
  const accentInput = flyout.querySelector('#flyoutColorAccent');
  const themeModeToggle = flyout.querySelector('#flyoutThemeModeToggle');
  
  // Close button
  flyout.querySelector('.flyout-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllFlyouts();
  });
  
  // Prevent clicks inside flyout from closing it
  flyout.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Preset buttons
  flyout.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const primary = btn.dataset.primary;
      const accent = btn.dataset.accent;
      primaryInput.value = primary;
      accentInput.value = accent;
      saveTheme({
        colorPrimary: primary,
        colorAccent: accent,
        themeMode: themeMode
      });
    });
  });
  
  // Color inputs
  primaryInput.addEventListener('input', () => {
    saveTheme({
      colorPrimary: primaryInput.value,
      colorAccent: accentInput.value,
      themeMode: themeMode
    });
  });
  
  accentInput.addEventListener('input', () => {
    saveTheme({
      colorPrimary: primaryInput.value,
      colorAccent: accentInput.value,
      themeMode: themeMode
    });
  });
  
  // Theme mode toggle (cycles through auto -> light -> dark)
  themeModeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    themeMode = getNextThemeMode(themeMode);
    themeModeToggle.textContent = getThemeModeDisplay(themeMode);
    saveTheme({
      colorPrimary: primaryInput.value,
      colorAccent: accentInput.value,
      themeMode: themeMode
    });
  });
  
  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}

// Handle clicks outside flyouts
function handleOutsideClick(e) {
  const flyout = document.querySelector('.flyout');
  if (flyout && !flyout.contains(e.target) && !addWidgetBtn.contains(e.target) && !customizeBtn.contains(e.target)) {
    closeAllFlyouts();
  }
}

// Close all flyouts
function closeAllFlyouts() {
  document.querySelectorAll('.flyout').forEach(f => f.remove());
  document.removeEventListener('click', handleOutsideClick);
}

// Setup event listeners
function setupEventListeners() {
  // Edit mode toggle
  editToggle.addEventListener('click', toggleEditMode);
  
  // Add widget button
  addWidgetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('addWidgetFlyout')) {
      closeAllFlyouts();
    } else {
      showAddWidgetFlyout();
    }
  });
  
  // Customize button
  customizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.getElementById('customizeFlyout')) {
      closeAllFlyouts();
    } else {
      showCustomizeFlyout();
    }
  });
}

// Toggle edit mode
function toggleEditMode() {
  editMode = !editMode;
  editToggle.classList.toggle('active', editMode);
  editToggle.querySelector('.edit-icon').textContent = editMode ? '✓' : '⚙';
  editToggle.title = editMode ? 'Done' : 'Edit';
  dashboard.classList.toggle('edit-mode', editMode);
  
  // Show/hide edit mode buttons
  addWidgetBtn.classList.toggle('visible', editMode);
  customizeBtn.classList.toggle('visible', editMode);
  
  // Enable/disable widget dragging
  dashboard.querySelectorAll('.widget').forEach(el => {
    el.draggable = editMode;
  });
  
  // Close flyouts when exiting edit mode
  if (!editMode) {
    closeAllFlyouts();
  }
}

// Render the dashboard
function renderDashboard() {
  dashboard.innerHTML = '';

  if (widgets.length === 0) {
    dashboard.innerHTML = `
      <div class="dashboard-empty">
        <div class="dashboard-empty-icon">📦</div>
        <p>No widgets yet. Click Edit to add some!</p>
      </div>
    `;
    return;
  }

  widgets.forEach(widget => {
    const el = widget.createElement(removeWidget, resizeWidget, openWidgetConfig);
    // If in edit mode, make widget draggable
    if (editMode) {
      el.draggable = true;
    }
    dashboard.appendChild(el);
  });
}

// Setup drag and drop on the dashboard
function setupDashboardDragDrop() {
  dashboard.addEventListener('dragover', (e) => {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Track which widget is being dragged
    if (!draggingWidget) {
      const draggingEl = dashboard.querySelector('.widget.dragging');
      if (draggingEl) {
        draggingWidget = widgets.find(w => w.id === draggingEl.dataset.id);
      }
    }
    
    // Show drop indicator with widget dimensions
    const pos = getGridPositionFromEvent(e);
    const width = draggingWidget?.width ?? 1;
    const height = draggingWidget?.height ?? 1;
    updateDropIndicator(pos.x, pos.y, width, height);
  });

  dashboard.addEventListener('dragleave', (e) => {
    // Only remove indicator if leaving the dashboard entirely
    if (!dashboard.contains(e.relatedTarget)) {
      removeDropIndicator();
      draggingWidget = null;
    }
  });

  dashboard.addEventListener('drop', (e) => {
    if (!editMode) return;
    e.preventDefault();
    removeDropIndicator();
    draggingWidget = null;
    
    const widgetId = e.dataTransfer.getData('text/plain');
    const pos = getGridPositionFromEvent(e);
    moveWidget(widgetId, pos.x, pos.y);
  });
}

// Calculate grid position from mouse event
function getGridPositionFromEvent(e) {
  const rect = dashboard.getBoundingClientRect();
  const padding = 32; // 2rem padding
  const gap = 16; // var(--grid-gap)
  const cellSize = GRID_CELL_SIZE;
  
  const relativeX = e.clientX - rect.left - padding;
  const relativeY = e.clientY - rect.top - padding;
  
  const x = Math.max(0, Math.floor(relativeX / (cellSize + gap)));
  const y = Math.max(0, Math.floor(relativeY / (cellSize + gap)));
  
  return { x, y };
}

// Show drop indicator at grid position with widget dimensions
function updateDropIndicator(x, y, width = 1, height = 1) {
  let indicator = dashboard.querySelector('.drop-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    dashboard.appendChild(indicator);
  }
  indicator.style.gridColumn = `${x + 1} / span ${width}`;
  indicator.style.gridRow = `${y + 1} / span ${height}`;
}

// Remove drop indicator
function removeDropIndicator() {
  const indicator = dashboard.querySelector('.drop-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Move a widget to a new position
function moveWidget(id, newX, newY) {
  const widget = widgets.find(w => w.id === id);
  if (widget) {
    widget.x = newX;
    widget.y = newY;
    saveWidgets();
    renderDashboard();
  }
}

// Find next available position for a new widget
function findNextPosition() {
  // Find the maximum y position used, then place at the next row
  let maxY = -1;
  widgets.forEach(w => {
    const bottomY = w.y + w.height;
    if (bottomY > maxY) maxY = bottomY;
  });
  return { x: 0, y: maxY < 0 ? 0 : maxY };
}

// Add a new widget
function addWidget(type) {
  const id = `widget-${Date.now()}`;
  const pos = findNextPosition();
  const config = {
    id,
    type,
    x: pos.x,
    y: pos.y,
    width: 1,
    height: 1,
    data: {}
  };
  const newWidget = createWidget(config);
  // Inject saveWidgets callback for widgets that need it
  if (newWidget.saveWidgets !== undefined) {
    newWidget.saveWidgets = saveWidgets;
  }
  widgets.push(newWidget);
  saveWidgets();
  renderDashboard();
}

// Remove a widget
function removeWidget(id) {
  const widget = widgets.find(w => w.id === id);
  if (widget && widget.destroy) {
    widget.destroy();
  }
  widgets = widgets.filter(w => w.id !== id);
  saveWidgets();
  renderDashboard();
}

// Resize widget to specific dimensions
function resizeWidget(id, newWidth, newHeight) {
  const widget = widgets.find(w => w.id === id);
  if (widget) {
    widget.width = newWidth;
    widget.height = newHeight;
    saveWidgets();
    renderDashboard();
  }
}

// Open widget configuration dialog
function openWidgetConfig(id) {
  const widget = widgets.find(w => w.id === id);
  if (!widget) return;

  // Remove existing dialog if any
  closeWidgetConfig();

  const dialog = document.createElement('div');
  dialog.className = 'widget-config-overlay';
  dialog.innerHTML = `
    <div class="widget-config-dialog">
      <div class="widget-config-header">
        <h3>Configure Widget</h3>
        <button class="widget-config-close" title="Close">✕</button>
      </div>
      <div class="widget-config-content">
        <div class="widget-config-section">
          <h4>Position & Size</h4>
          <div class="widget-config-grid">
            <label>
              <span>X Position</span>
              <input type="number" name="x" value="${widget.x}" min="0">
            </label>
            <label>
              <span>Y Position</span>
              <input type="number" name="y" value="${widget.y}" min="0">
            </label>
            <label>
              <span>Width</span>
              <input type="number" name="width" value="${widget.width}" min="1">
            </label>
            <label>
              <span>Height</span>
              <input type="number" name="height" value="${widget.height}" min="1">
            </label>
          </div>
        </div>
        ${renderWidgetConfigFields(widget)}
      </div>
      <div class="widget-config-footer">
        <button class="widget-config-btn delete">Delete Widget</button>
        <div class="widget-config-footer-right">
          <button class="widget-config-btn cancel">Cancel</button>
          <button class="widget-config-btn save">Save</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Close button
  dialog.querySelector('.widget-config-close').addEventListener('click', closeWidgetConfig);
  dialog.querySelector('.widget-config-btn.cancel').addEventListener('click', closeWidgetConfig);
  
  // Delete button
  dialog.querySelector('.widget-config-btn.delete').addEventListener('click', () => {
    closeWidgetConfig();
    removeWidget(id);
  });
  
  // Click outside to close
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeWidgetConfig();
  });

  // Save button
  dialog.querySelector('.widget-config-btn.save').addEventListener('click', () => {
    saveWidgetConfig(widget, dialog);
  });
}

// Render widget-specific config fields
function renderWidgetConfigFields(widget) {
  const schema = widget.getConfigSchema();
  if (schema.length === 0) return '';

  let html = `<div class="widget-config-section"><h4>Widget Settings</h4>`;

  for (const field of schema) {
    const value = widget.data[field.key] ?? field.default;
    html += `<div class="widget-config-field">`;

    switch (field.type) {
      case 'string':
        html += `
          <label>
            <span>${field.label}</span>
            <input type="text" name="config_${field.key}" value="${escapeHtml(value || '')}">
          </label>
        `;
        break;

      case 'text':
        html += `
          <label>
            <span>${field.label}</span>
            <textarea name="config_${field.key}">${escapeHtml(value || '')}</textarea>
          </label>
        `;
        break;

      case 'number':
        html += `
          <label>
            <span>${field.label}</span>
            <input type="number" name="config_${field.key}" value="${value || 0}">
          </label>
        `;
        break;

      case 'boolean':
        html += `
          <label class="checkbox-label">
            <input type="checkbox" name="config_${field.key}" ${value ? 'checked' : ''}>
            <span>${field.label}</span>
          </label>
        `;
        break;

      case 'select':
        html += `
          <label>
            <span>${field.label}</span>
            <select name="config_${field.key}">
              ${field.options.map(opt => {
                const optValue = typeof opt === 'object' ? opt.value : opt;
                const optLabel = typeof opt === 'object' ? opt.label : opt;
                return `<option value="${optValue}" ${value === optValue ? 'selected' : ''}>${optLabel}</option>`;
              }).join('')}
            </select>
          </label>
        `;
        break;

      case 'list':
        html += `
          <div class="widget-config-list" data-field="${field.key}">
            <span class="widget-config-list-label">${field.label}</span>
            <div class="widget-config-list-items">
              ${(value || []).map((item, index) => renderListItem(field, item, index)).join('')}
            </div>
            <button type="button" class="widget-config-list-add" data-field="${field.key}">+ Add Item</button>
          </div>
        `;
        break;
    }

    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

// Render a single list item
function renderListItem(field, item, index) {
  let html = `<div class="widget-config-list-item" data-index="${index}">`;
  for (const subField of field.fields) {
    const subValue = item[subField.key] || '';
    html += `
      <input type="text" 
             name="config_${field.key}_${index}_${subField.key}" 
             placeholder="${subField.label}"
             value="${escapeHtml(subValue)}">
    `;
  }
  html += `<button type="button" class="widget-config-list-remove" data-index="${index}">✕</button>`;
  html += `</div>`;
  return html;
}

// Escape HTML for safe insertion
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Save widget configuration
function saveWidgetConfig(widget, dialog) {
  // Save position and size
  widget.x = parseInt(dialog.querySelector('input[name="x"]').value) || 0;
  widget.y = parseInt(dialog.querySelector('input[name="y"]').value) || 0;
  widget.width = Math.max(1, parseInt(dialog.querySelector('input[name="width"]').value) || 1);
  widget.height = Math.max(1, parseInt(dialog.querySelector('input[name="height"]').value) || 1);

  // Save widget-specific config
  const schema = widget.getConfigSchema();
  for (const field of schema) {
    if (field.type === 'list') {
      // Collect list items
      const items = [];
      const listContainer = dialog.querySelector(`.widget-config-list[data-field="${field.key}"] .widget-config-list-items`);
      const listItems = listContainer.querySelectorAll('.widget-config-list-item');
      
      listItems.forEach((itemEl, index) => {
        const item = {};
        for (const subField of field.fields) {
          const input = itemEl.querySelector(`input[name="config_${field.key}_${index}_${subField.key}"]`);
          if (input) {
            item[subField.key] = input.value;
          }
        }
        items.push(item);
      });
      widget.data[field.key] = items;
    } else if (field.type === 'boolean') {
      const input = dialog.querySelector(`input[name="config_${field.key}"]`);
      widget.data[field.key] = input?.checked || false;
    } else if (field.type === 'number') {
      const input = dialog.querySelector(`input[name="config_${field.key}"]`);
      widget.data[field.key] = parseFloat(input?.value) || 0;
    } else {
      const input = dialog.querySelector(`[name="config_${field.key}"]`);
      widget.data[field.key] = input?.value || '';
    }
  }

  saveWidgets();
  closeWidgetConfig();
  renderDashboard();
}

// Close widget configuration dialog
function closeWidgetConfig() {
  const overlay = document.querySelector('.widget-config-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Setup list item add/remove handlers (using event delegation)
document.addEventListener('click', (e) => {
  // Add list item
  if (e.target.classList.contains('widget-config-list-add')) {
    const fieldKey = e.target.dataset.field;
    const listContainer = e.target.closest('.widget-config-list');
    const itemsContainer = listContainer.querySelector('.widget-config-list-items');
    
    // Find the field schema
    const overlay = document.querySelector('.widget-config-overlay');
    if (overlay) {
      // Get field info from existing items
      const existingItems = itemsContainer.querySelectorAll('.widget-config-list-item');
      const newIndex = existingItems.length;
      
      // Create new item based on first item structure or field key
      const firstItem = existingItems[0];
      if (firstItem) {
        const newItem = document.createElement('div');
        newItem.className = 'widget-config-list-item';
        newItem.dataset.index = newIndex;
        
        const inputs = firstItem.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
          const nameParts = input.name.split('_');
          const subFieldKey = nameParts[nameParts.length - 1];
          const newInput = document.createElement('input');
          newInput.type = 'text';
          newInput.name = `config_${fieldKey}_${newIndex}_${subFieldKey}`;
          newInput.placeholder = input.placeholder;
          newItem.appendChild(newInput);
        });
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'widget-config-list-remove';
        removeBtn.dataset.index = newIndex;
        removeBtn.textContent = '✕';
        newItem.appendChild(removeBtn);
        
        itemsContainer.appendChild(newItem);
      }
    }
  }

  // Remove list item
  if (e.target.classList.contains('widget-config-list-remove')) {
    const listItem = e.target.closest('.widget-config-list-item');
    if (listItem) {
      listItem.remove();
    }
  }
});

