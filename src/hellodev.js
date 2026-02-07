// HelloDev Dashboard

import { createWidget, WidgetRegistry } from './widgets/index.js';

const STORAGE_KEY = 'hellodev-widgets';
const THEME_STORAGE_KEY = 'hellodev-theme';

// Version number for saved widget state. Increment this when the saved state format
// changes in an incompatible manner that would break loading of previously saved data.
const STORAGE_VERSION = 1;

// Grid cell size in pixels
const GRID_CELL_SIZE = 160;

// Default theme colors
const DEFAULT_THEME = {
  colorPrimary: '#1a1a2e',
  colorAccent: '#667eea',
  lightMode: false
};

// ============================================================================
// Dashboard State & Logic
// ============================================================================

// Default widget configurations
const DEFAULT_WIDGETS = [
  { id: 'widget-1', type: 'clock', x: 0, y: 0, width: 2, height: 1 },
  { id: 'widget-2', type: 'search', x: 2, y: 0, width: 2, height: 1 }
];

// State
let widgets = [];
let editMode = false;
let lightMode = false;
let draggingWidget = null;

// DOM elements
const dashboard = document.getElementById('dashboard');
const editToggle = document.getElementById('editToggle');
const themeToggle = document.getElementById('themeToggle');
const widgetPanel = document.getElementById('widgetPanel');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadTheme();
  loadWidgets();
  renderDashboard();
  setupEventListeners();
  setupDashboardDragDrop();
  setupThemeControls();
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
      theme = { ...DEFAULT_THEME, ...JSON.parse(stored) };
    } catch (e) {
      theme = DEFAULT_THEME;
    }
  }

  lightMode = theme.lightMode || false;
  applyTheme(theme);
}

// Apply theme colors to CSS custom properties
function applyTheme(theme) {
  document.documentElement.style.setProperty('--color-primary', theme.colorPrimary);
  document.documentElement.style.setProperty('--color-accent', theme.colorAccent);
  
  // Apply light/dark mode
  document.body.classList.toggle('light-mode', theme.lightMode || false);
  if (themeToggle) {
    themeToggle.querySelector('.theme-icon').textContent = theme.lightMode ? '☀' : '☾';
  }
}

// Save theme to storage
function saveTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  applyTheme(theme);
}

// Setup theme color picker controls
function setupThemeControls() {
  const primaryInput = document.getElementById('colorPrimary');
  const accentInput = document.getElementById('colorAccent');

  // Load saved values into inputs
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored) {
    try {
      const theme = JSON.parse(stored);
      if (theme.colorPrimary) primaryInput.value = theme.colorPrimary;
      if (theme.colorAccent) accentInput.value = theme.colorAccent;
    } catch (e) {
      // Use defaults
    }
  }

  // Update theme on color change
  primaryInput.addEventListener('input', () => {
    saveTheme({
      colorPrimary: primaryInput.value,
      colorAccent: accentInput.value,
      lightMode: lightMode
    });
  });

  accentInput.addEventListener('input', () => {
    saveTheme({
      colorPrimary: primaryInput.value,
      colorAccent: accentInput.value,
      lightMode: lightMode
    });
  });

  // Light/dark mode toggle
  themeToggle.addEventListener('click', () => {
    lightMode = !lightMode;
    saveTheme({
      colorPrimary: primaryInput.value,
      colorAccent: accentInput.value,
      lightMode: lightMode
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Edit mode toggle
  editToggle.addEventListener('click', toggleEditMode);

  // Dynamically generate widget buttons from registry
  const widgetOptionsContainer = widgetPanel.querySelector('.widget-options');
  widgetOptionsContainer.innerHTML = '';
  
  for (const [type, WidgetClass] of Object.entries(WidgetRegistry)) {
    const { name, icon } = WidgetClass.metadata;
    const btn = document.createElement('button');
    btn.className = 'widget-option';
    btn.dataset.widget = type;
    btn.textContent = `${icon} ${name}`;
    btn.addEventListener('click', () => addWidget(type));
    widgetOptionsContainer.appendChild(btn);
  }
}

// Toggle edit mode
function toggleEditMode() {
  editMode = !editMode;
  editToggle.classList.toggle('active', editMode);
  editToggle.querySelector('.edit-icon').textContent = editMode ? '✓' : '⚙';
  editToggle.title = editMode ? 'Done' : 'Edit';
  dashboard.classList.toggle('edit-mode', editMode);
  widgetPanel.classList.toggle('visible', editMode);
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

