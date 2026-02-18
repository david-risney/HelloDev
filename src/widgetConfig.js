// Widget configuration dialog management

import { safeHtml, rawHtml, escapeHtml } from './htmlUtils.js';

// Render a single list item row
function renderListItem(field, item, index) {
  let inputsHtml = '';
  for (const subField of field.fields) {
    const subValue = item[subField.key] || '';
    inputsHtml += safeHtml`
      <input type="text"
             name="config_${field.key}_${index}_${subField.key}"
             placeholder="${subField.label}"
             value="${subValue}">
    `;
  }
  return safeHtml`<div class="widget-config-list-item" data-index="${index}">${rawHtml(inputsHtml)}<button type="button" class="widget-config-list-remove" data-index="${index}">\u2715</button></div>`;
}

// Render widget-specific config fields based on the widget's config schema
function renderWidgetConfigFields(widget) {
  const schema = widget.getConfigSchema();
  if (schema.length === 0) return '';

  let html = '<div class="widget-config-section"><h4>Widget Settings</h4>';

  for (const field of schema) {
    const value = widget.data[field.key] ?? field.default;
    html += '<div class="widget-config-field">';

    switch (field.type) {
      case 'string':
        html += safeHtml`
          <label>
            <span>${field.label}</span>
            <input type="text" name="config_${field.key}" value="${value || ''}">
          </label>
        `;
        break;

      case 'text':
        html += safeHtml`
          <label>
            <span>${field.label}</span>
            <textarea name="config_${field.key}">${value || ''}</textarea>
          </label>
        `;
        break;

      case 'number':
        html += safeHtml`
          <label>
            <span>${field.label}</span>
            <input type="number" name="config_${field.key}" value="${value || 0}">
          </label>
        `;
        break;

      case 'boolean':
        html += safeHtml`
          <label class="checkbox-label">
            <input type="checkbox" name="config_${field.key}" ${rawHtml(value ? 'checked' : '')}>
            <span>${field.label}</span>
          </label>
        `;
        break;

      case 'select':
        html += safeHtml`
          <label>
            <span>${field.label}</span>
            <select name="config_${field.key}">
              ${rawHtml(field.options.map(opt => {
                const optValue = typeof opt === 'object' ? opt.value : opt;
                const optLabel = typeof opt === 'object' ? opt.label : opt;
                return safeHtml`<option value="${optValue}" ${rawHtml(value === optValue ? 'selected' : '')}>${optLabel}</option>`;
              }).join(''))}
            </select>
          </label>
        `;
        break;

      case 'list':
        html += safeHtml`
          <div class="widget-config-list" data-field="${field.key}">
            <span class="widget-config-list-label">${field.label}</span>
            <div class="widget-config-list-items">
              ${rawHtml((value || []).map((item, index) => renderListItem(field, item, index)).join(''))}
            </div>
            <button type="button" class="widget-config-list-add" data-field="${field.key}">+ Add Item</button>
          </div>
        `;
        break;
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

// Collect form values and save them back to the widget
function saveWidgetConfig(widget, dialog, { saveWidgets, closeWidgetConfig, renderDashboard }) {
  // Save position, size, z-index, and stretch fill
  widget.x = parseInt(dialog.querySelector('input[name="x"]').value) || 0;
  widget.y = parseInt(dialog.querySelector('input[name="y"]').value) || 0;
  widget.zIndex = parseInt(dialog.querySelector('input[name="zIndex"]').value) || 0;
  widget.width = Math.max(1, parseInt(dialog.querySelector('input[name="width"]').value) || 1);
  widget.height = Math.max(1, parseInt(dialog.querySelector('input[name="height"]').value) || 1);
  widget.stretchFill = dialog.querySelector('input[name="stretchFill"]')?.checked || false;

  // Collect widget-specific config values
  const schema = widget.getConfigSchema();
  const configValues = {};

  for (const field of schema) {
    if (field.type === 'list') {
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
      configValues[field.key] = items;
    } else if (field.type === 'boolean') {
      const input = dialog.querySelector(`input[name="config_${field.key}"]`);
      configValues[field.key] = input?.checked || false;
    } else if (field.type === 'number') {
      const input = dialog.querySelector(`input[name="config_${field.key}"]`);
      configValues[field.key] = parseFloat(input?.value) || 0;
    } else {
      const input = dialog.querySelector(`[name="config_${field.key}"]`);
      configValues[field.key] = input?.value || '';
    }
  }

  // Use setConfig to apply values (allows widgets to override and react to changes)
  widget.setConfig(configValues);

  saveWidgets();
  closeWidgetConfig();
  renderDashboard();
}

// Close the widget configuration dialog overlay
export function closeWidgetConfig() {
  const overlay = document.querySelector('.widget-config-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Open the widget configuration dialog.
// callbacks: { removeWidget, saveWidgets, renderDashboard }
export function openWidgetConfig(widget, callbacks) {
  // Remove existing dialog if any
  closeWidgetConfig();

  const dialog = document.createElement('div');
  dialog.className = 'widget-config-overlay';
  dialog.innerHTML = safeHtml`
    <div class="widget-config-dialog">
      <div class="widget-config-header">
        <div class="widget-config-nav">
          <button class="widget-config-nav-btn" data-dir="prev" title="Previous widget">&lt;</button>
          <button class="widget-config-nav-btn" data-dir="next" title="Next widget">&gt;</button>
        </div>
        <h3>Configure Widget</h3>
        <button class="widget-config-close" title="Close">\u2715</button>
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
            <label>
              <span>Z-Index</span>
              <input type="number" name="zIndex" value="${widget.zIndex}">
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="stretchFill" ${rawHtml(widget.stretchFill ? 'checked' : '')}>
              <span>Stretch Fill</span>
            </label>
          </div>
        </div>
        ${rawHtml(renderWidgetConfigFields(widget))}
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
    callbacks.removeWidget(widget.id);
  });

  // Click outside to close
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeWidgetConfig();
  });

  // Save button
  dialog.querySelector('.widget-config-btn.save').addEventListener('click', () => {
    saveWidgetConfig(widget, dialog, {
      saveWidgets: callbacks.saveWidgets,
      closeWidgetConfig,
      renderDashboard: callbacks.renderDashboard
    });
  });

  // Prev/Next navigation buttons
  dialog.querySelectorAll('.widget-config-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const widgets = callbacks.widgets || [];
      const currentIndex = widgets.findIndex(w => w.id === widget.id);
      if (currentIndex === -1) return;

      const dir = btn.dataset.dir;
      const nextIndex = dir === 'prev'
        ? (currentIndex - 1 + widgets.length) % widgets.length
        : (currentIndex + 1) % widgets.length;

      // Save current widget before navigating
      saveWidgetConfig(widget, dialog, {
        saveWidgets: callbacks.saveWidgets,
        closeWidgetConfig,
        renderDashboard: callbacks.renderDashboard
      });

      // Open the next/prev widget's config
      callbacks.openWidgetConfig(widgets[nextIndex].id);
    });
  });
}

// Setup list item add/remove handlers (using event delegation on document)
export function setupWidgetConfigDelegation() {
  document.addEventListener('click', (e) => {
    // Add list item
    if (e.target.classList.contains('widget-config-list-add')) {
      const fieldKey = e.target.dataset.field;
      const listContainer = e.target.closest('.widget-config-list');
      const itemsContainer = listContainer.querySelector('.widget-config-list-items');

      const overlay = document.querySelector('.widget-config-overlay');
      if (overlay) {
        const existingItems = itemsContainer.querySelectorAll('.widget-config-list-item');
        const newIndex = existingItems.length;

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
          removeBtn.textContent = '\u2715';
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
}
