// Flyout panel system for HelloDev dashboard

import { STORAGE_KEY } from './constants.js';
import { WidgetRegistry } from './widgets/index.js';
import { WidgetPacks } from './widgetPacks.js';
import { getThemeModeDisplay, getNextThemeMode, saveTheme } from './theme.js';
import { clearSync } from './syncStorage.js';
import { safeHtml, rawHtml, escapeHtml } from './htmlUtils.js';

// Button element references (set by init)
let buttonEls = {};

// Initialize flyout system with references to toolbar button elements
export function initFlyouts(elements) {
  buttonEls = elements;
}

// Handle clicks outside flyouts
function handleOutsideClick(e) {
  const flyout = document.querySelector('.flyout');
  if (flyout && !flyout.contains(e.target) &&
      !buttonEls.addWidgetBtn.contains(e.target) &&
      !buttonEls.customizeBtn.contains(e.target) &&
      !buttonEls.dataBtn.contains(e.target) &&
      !buttonEls.aboutBtn.contains(e.target)) {
    closeAllFlyouts();
  }
}

// Close all flyouts and remove outside-click listener
export function closeAllFlyouts() {
  document.querySelectorAll('.flyout').forEach(f => f.remove());
  document.removeEventListener('click', handleOutsideClick);
}

// Create a flyout panel with standard boilerplate (close button, outside click, etc.)
function createFlyout({ id, parentEl, title, dialogClass, contentHtml, onSetup }) {
  closeAllFlyouts();

  const flyout = document.createElement('div');
  flyout.className = 'flyout';
  flyout.id = id;

  flyout.innerHTML = `
    <div class="flyout-dialog${dialogClass ? ' ' + dialogClass : ''}">
      <div class="flyout-header">
        <h3>${title}</h3>
        <button class="flyout-close" title="Close">\u2715</button>
      </div>
      <div class="flyout-content">
        ${contentHtml}
      </div>
    </div>
  `;

  parentEl.appendChild(flyout);

  // Close button
  flyout.querySelector('.flyout-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllFlyouts();
  });

  // Prevent clicks inside flyout from closing it
  flyout.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Close when clicking outside (remove first to prevent duplicate listeners)
  setTimeout(() => {
    document.removeEventListener('click', handleOutsideClick);
    document.addEventListener('click', handleOutsideClick);
  }, 0);

  // Let the caller attach flyout-specific event listeners
  if (onSetup) {
    onSetup(flyout);
  }

  return flyout;
}

// ---- Widget Pack property prompt ----

// Render a property-prompt form for a Widget Pack inside a flyout.
function renderPackPrompt(pack) {
  let fieldsHtml = '';
  for (const field of pack.properties) {
    fieldsHtml += '<div class="pack-prompt-field">';
    switch (field.type) {
      case 'select':
        fieldsHtml += safeHtml`
          <label>
            <span>${field.label}</span>
            <select name="pack_${field.key}">
              ${rawHtml(field.options.map(opt => {
                const optValue = typeof opt === 'object' ? opt.value : opt;
                const optLabel = typeof opt === 'object' ? opt.label : opt;
                return safeHtml`<option value="${optValue}" ${rawHtml(field.default === optValue ? 'selected' : '')}>${optLabel}</option>`;
              }).join(''))}
            </select>
          </label>`;
        break;
      default:
        fieldsHtml += safeHtml`
          <label>
            <span>${field.label}</span>
            <input type="text" name="pack_${field.key}" value="${field.default || ''}" placeholder="${field.placeholder || ''}">
          </label>`;
        break;
    }
    fieldsHtml += '</div>';
  }

  return `
    <div class="pack-prompt">
      <div class="pack-prompt-desc">${escapeHtml(pack.description)}</div>
      <div class="pack-prompt-fields">${fieldsHtml}</div>
      <button class="pack-prompt-submit">Add Pack</button>
    </div>
  `;
}

// Collect values from the pack prompt form
function collectPackProps(flyout, pack) {
  const props = {};
  for (const field of pack.properties) {
    const el = flyout.querySelector(`[name="pack_${field.key}"]`);
    props[field.key] = el ? el.value : (field.default || '');
  }
  return props;
}

// Show Add Widget flyout
export function showAddWidgetFlyout(addWidget, addWidgetPack, { initialFilter } = {}) {
  // Build pack buttons (shown first)
  let packButtons = '';
  for (const pack of WidgetPacks) {
    packButtons += `<button class="widget-option pack-option" data-pack="${pack.id}">${pack.icon} ${escapeHtml(pack.name)}<span class="pack-badge">Pack</span></button>`;
  }

  // Collect all widgets and sort by group then by name
  const widgets = Object.entries(WidgetRegistry).map(([type, WidgetClass]) => {
    const { name, icon, group } = WidgetClass.metadata;
    return { type, name, icon, group: group || 'Utility' };
  });
  widgets.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

  let widgetButtons = '';
  for (const { type, name, icon } of widgets) {
    widgetButtons += `<button class="widget-option" data-widget="${type}">${icon} ${name}</button>`;
  }

  const contentHtml = `
    <input type="text" class="widget-filter" placeholder="Filter widgets\u2026" />
    <div class="widget-group pack-group">
      <div class="widget-group-label">Packs</div>
      <div class="widget-options-grid">
        ${packButtons}
      </div>
    </div>
    <div class="widget-group">
      <div class="widget-group-label">Widgets</div>
      <div class="widget-options-grid">
        ${widgetButtons}
      </div>
    </div>`;

  createFlyout({
    id: 'addWidgetFlyout',
    parentEl: buttonEls.addWidgetBtn,
    title: 'Add Widget',
    contentHtml,
    onSetup(flyout) {
      // Individual widget buttons
      flyout.querySelectorAll('.widget-option[data-widget]').forEach(btn => {
        btn.addEventListener('click', () => {
          addWidget(btn.dataset.widget);
          closeAllFlyouts();
        });
      });

      // Pack buttons — show property prompt
      flyout.querySelectorAll('.pack-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const pack = WidgetPacks.find(p => p.id === btn.dataset.pack);
          if (!pack) return;
          showPackPromptFlyout(pack, addWidgetPack);
        });
      });

      const filterInput = flyout.querySelector('.widget-filter');
      filterInput.addEventListener('input', () => {
        const term = filterInput.value.toLowerCase();
        // Filter individual widgets
        flyout.querySelectorAll('.widget-option[data-widget]').forEach(btn => {
          const name = btn.textContent.toLowerCase();
          btn.style.display = name.includes(term) ? '' : 'none';
        });
        // Filter packs
        flyout.querySelectorAll('.pack-option').forEach(btn => {
          const pack = WidgetPacks.find(p => p.id === btn.dataset.pack);
          const text = (btn.textContent + ' ' + (pack?.description || '')).toLowerCase();
          btn.style.display = text.includes(term) ? '' : 'none';
        });
        // Show/hide group labels when all children hidden
        flyout.querySelectorAll('.widget-group').forEach(group => {
          const visibleBtns = group.querySelectorAll('.widget-option:not([style*="display: none"])');
          group.style.display = visibleBtns.length === 0 ? 'none' : '';
        });
      });
      filterInput.focus();

      // Pre-fill filter from action link if provided
      if (initialFilter) {
        filterInput.value = initialFilter;
        filterInput.dispatchEvent(new Event('input'));
      }
    }
  });
}

// Show the pack property prompt as its own flyout
export function showPackPromptFlyout(pack, addWidgetPack) {
  const contentHtml = renderPackPrompt(pack);

  createFlyout({
    id: 'packPromptFlyout',
    parentEl: buttonEls.addWidgetBtn,
    title: `${pack.icon} ${pack.name}`,
    contentHtml,
    onSetup(flyout) {
      const submitBtn = flyout.querySelector('.pack-prompt-submit');
      submitBtn.addEventListener('click', () => {
        const props = collectPackProps(flyout, pack);
        const widgetConfigs = pack.createWidgets(props);
        addWidgetPack(widgetConfigs);
        closeAllFlyouts();
      });

      // Focus the first input
      const firstInput = flyout.querySelector('input[type="text"], select');
      if (firstInput) firstInput.focus();

      // Submit on Enter from text inputs
      flyout.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitBtn.click();
          }
        });
      });
    }
  });
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
export function showCustomizeFlyout(state, { onThemeChanged } = {}) {
  const presetButtons = COLOR_PRESETS.map(preset =>
    `<button class="preset-btn" data-primary="${preset.primary}" data-accent="${preset.accent}" title="${preset.name}">
      <span class="preset-primary" style="background: ${preset.primary}"></span>
      <span class="preset-accent" style="background: ${preset.accent}"></span>
    </button>`
  ).join('');

  createFlyout({
    id: 'customizeFlyout',
    parentEl: buttonEls.customizeBtn,
    title: 'Appearance',
    contentHtml: `
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
          <input type="color" id="flyoutColorPrimary" value="${state.currentTheme.colorPrimary}">
        </div>
        <div class="customize-row">
          <span>Accent</span>
          <input type="color" id="flyoutColorAccent" value="${state.currentTheme.colorAccent}">
        </div>
      </div>
      <div class="customize-section">
        <div class="customize-row">
          <span>Theme</span>
          <button class="toggle-btn" id="flyoutThemeModeToggle">
            ${getThemeModeDisplay(state.themeMode)}
          </button>
        </div>
      </div>
    `,
    onSetup(flyout) {
      const primaryInput = flyout.querySelector('#flyoutColorPrimary');
      const accentInput = flyout.querySelector('#flyoutColorAccent');
      const themeModeToggle = flyout.querySelector('#flyoutThemeModeToggle');

      // Preset buttons
      flyout.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const primary = btn.dataset.primary;
          const accent = btn.dataset.accent;
          primaryInput.value = primary;
          accentInput.value = accent;
          saveTheme(state, {
            colorPrimary: primary,
            colorAccent: accent,
            themeMode: state.themeMode
          });
          if (onThemeChanged) onThemeChanged();
        });
      });

      // Color inputs
      primaryInput.addEventListener('input', () => {
        saveTheme(state, {
          colorPrimary: primaryInput.value,
          colorAccent: accentInput.value,
          themeMode: state.themeMode
        });
        if (onThemeChanged) onThemeChanged();
      });

      accentInput.addEventListener('input', () => {
        saveTheme(state, {
          colorPrimary: primaryInput.value,
          colorAccent: accentInput.value,
          themeMode: state.themeMode
        });
        if (onThemeChanged) onThemeChanged();
      });

      // Theme mode toggle (cycles through auto -> light -> dark)
      themeModeToggle.addEventListener('click', (e) => {
        e.preventDefault();
        state.themeMode = getNextThemeMode(state.themeMode);
        themeModeToggle.textContent = getThemeModeDisplay(state.themeMode);
        saveTheme(state, {
          colorPrimary: primaryInput.value,
          colorAccent: accentInput.value,
          themeMode: state.themeMode
        });
        if (onThemeChanged) onThemeChanged();
      });
    }
  });
}

// Show About flyout
export async function showAboutFlyout() {
  let version = '';
  try {
    const manifest = await fetch(chrome.runtime.getURL('manifest.json')).then(r => r.json());
    version = manifest.version;
  } catch (e) {
    version = 'unknown';
  }

  createFlyout({
    id: 'aboutFlyout',
    parentEl: buttonEls.aboutBtn,
    title: 'About HelloDev',
    dialogClass: 'about-dialog',
    contentHtml: `
      <div class="about-logo">
        <span class="about-logo-text">HelloDev</span>
        <span class="about-version">v${version}</span>
      </div>
      <div class="about-links">
        <a href="https://github.com/david-risney/HelloDev" target="_blank" class="about-link">
          <span class="about-link-icon">\ud83d\udce6</span>
          <span>GitHub Repository</span>
        </a>
        <a href="https://github.com/david-risney/HelloDev/blob/main/PRIVACY.md" target="_blank" class="about-link">
          <span class="about-link-icon">\ud83d\udd12</span>
          <span>Privacy Policy</span>
        </a>
        <a href="https://github.com/david-risney/HelloDev/issues" target="_blank" class="about-link">
          <span class="about-link-icon">\ud83d\udcac</span>
          <span>Send Feedback</span>
        </a>
      </div>
    `
  });
}

// Show Data Management flyout
export function showDataFlyout({ getExportData, importData } = {}) {
  createFlyout({
    id: 'dataFlyout',
    parentEl: buttonEls.dataBtn,
    title: 'Manage Data',
    dialogClass: 'data-dialog',
    contentHtml: `
      <div class="data-section">
        <div class="data-io-buttons">
          <button class="data-io-btn" id="exportDataBtn">
            <span>\ud83d\udce4</span>
            <span>Export Layout</span>
          </button>
          <button class="data-io-btn" id="importDataBtn">
            <span>\ud83d\udce5</span>
            <span>Import Layout</span>
          </button>
          <input type="file" id="importFileInput" accept=".json" class="hidden">
        </div>
        <hr class="data-divider">
        <p class="data-description">Clear all HelloDev data including widgets, settings, and preferences. This action cannot be undone.</p>
        <button class="data-clear-btn" id="clearDataBtn">
          <span>\ud83d\uddd1</span>
          <span>Clear All Data</span>
        </button>
      </div>
      <div class="data-confirm hidden" id="dataConfirm">
        <p class="data-warning">\u26a0\ufe0f Are you sure? This will reset everything to defaults.</p>
        <div class="data-confirm-buttons">
          <button class="data-cancel-btn" id="dataCancelBtn">Cancel</button>
          <button class="data-confirm-btn" id="dataConfirmBtn">Yes, Clear Everything</button>
        </div>
      </div>
    `,
    onSetup(flyout) {
      // Export layout
      flyout.querySelector('#exportDataBtn').addEventListener('click', () => {
        if (!getExportData) return;
        const data = getExportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hellodev-layout-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });

      // Import layout
      const fileInput = flyout.querySelector('#importFileInput');
      flyout.querySelector('#importDataBtn').addEventListener('click', () => {
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            if (importData) {
              importData(data);
              closeAllFlyouts();
            }
          } catch (err) {
            console.error('Failed to import layout:', err);
            alert('Invalid layout file. Please select a valid HelloDev JSON export.');
          }
        };
        reader.readAsText(file);
      });

      // Clear all data
      const clearBtn = flyout.querySelector('#clearDataBtn');
      const confirmSection = flyout.querySelector('#dataConfirm');
      const cancelBtn = flyout.querySelector('#dataCancelBtn');
      const confirmBtn = flyout.querySelector('#dataConfirmBtn');

      clearBtn.addEventListener('click', () => {
        clearBtn.classList.add('hidden');
        confirmSection.classList.remove('hidden');
      });

      cancelBtn.addEventListener('click', () => {
        confirmSection.classList.add('hidden');
        clearBtn.classList.remove('hidden');
      });

      confirmBtn.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        clearSync();
        window.location.reload();
      });
    }
  });
}
