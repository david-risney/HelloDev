// Flyout panel system for HelloDev dashboard

import { STORAGE_KEY, THEME_STORAGE_KEY } from './constants.js';
import { WidgetRegistry } from './widgets/index.js';
import { getThemeModeDisplay, getNextThemeMode, saveTheme } from './theme.js';

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

// Show Add Widget flyout
export function showAddWidgetFlyout(addWidget) {
  let widgetButtons = '';
  for (const [type, WidgetClass] of Object.entries(WidgetRegistry)) {
    const { name, icon } = WidgetClass.metadata;
    widgetButtons += `<button class="widget-option" data-widget="${type}">${icon} ${name}</button>`;
  }

  createFlyout({
    id: 'addWidgetFlyout',
    parentEl: buttonEls.addWidgetBtn,
    title: 'Add Widget',
    contentHtml: `
      <div class="widget-options-grid">
        ${widgetButtons}
      </div>
    `,
    onSetup(flyout) {
      flyout.querySelectorAll('.widget-option').forEach(btn => {
        btn.addEventListener('click', () => {
          addWidget(btn.dataset.widget);
          closeAllFlyouts();
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
export function showCustomizeFlyout(state) {
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
        });
      });

      // Color inputs
      primaryInput.addEventListener('input', () => {
        saveTheme(state, {
          colorPrimary: primaryInput.value,
          colorAccent: accentInput.value,
          themeMode: state.themeMode
        });
      });

      accentInput.addEventListener('input', () => {
        saveTheme(state, {
          colorPrimary: primaryInput.value,
          colorAccent: accentInput.value,
          themeMode: state.themeMode
        });
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
export function showDataFlyout() {
  createFlyout({
    id: 'dataFlyout',
    parentEl: buttonEls.dataBtn,
    title: 'Manage Data',
    dialogClass: 'data-dialog',
    contentHtml: `
      <div class="data-section">
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
        localStorage.removeItem(THEME_STORAGE_KEY);
        window.location.reload();
      });
    }
  });
}
