import { GRID_CELL_SIZE, GRID_GAP } from '../constants.js';

/**
 * Base class for all widgets
 * 
 * ================================================================================
 * HOW TO ADD A NEW WIDGET
 * ================================================================================
 * 
 * 1. CREATE THE WIDGET FILE
 *    - Create a new file in src/widgets/ named YourWidget.js
 *    - Import and extend WidgetBase:
 *      
 *      import { WidgetBase } from './WidgetBase.js';
 *      
 *      export class YourWidget extends WidgetBase {
 *        static metadata = {
 *          name: 'Your Widget',
 *          icon: '🎯'  // Choose an appropriate emoji
 *        };
 *        
 *        getContent() {
 *          return '<div class="your-widget">Your content here</div>';
 *        }
 *        
 *        setup() {
 *          // Optional: Add event listeners, initialize state, etc.
 *        }
 *        
 *        cleanup() {
 *          // Optional: Clean up timers, event listeners, etc.
 *        }
 *      }
 * 
 * 2. REGISTER THE WIDGET IN index.js
 *    - Add an export statement at the top:
 *      export { YourWidget } from './YourWidget.js';
 *    
 *    - Add an import statement:
 *      import { YourWidget } from './YourWidget.js';
 *    
 *    - Add to WidgetRegistry with a unique key:
 *      export const WidgetRegistry = {
 *        ...existing widgets...,
 *        yourwidget: YourWidget
 *      };
 * 
 * 3. ADD STYLES (Optional)
 *    - Add CSS for your widget in src/hellodev.css
 *    - Use a class prefix matching your widget (e.g., .your-widget)
 * 
 * 4. ADD CONFIGURATION (Optional)
 *    - Override getConfigSchema() to define user-configurable options
 *    - See the getConfigSchema() method documentation below for field types
 * 
 * 5. ADD TO DEFAULT LAYOUT (Optional)
 *    - To include the widget in the default layout for new users, add an entry
 *      to DEFAULT_STATE.widgets in src/defaultState.js with position and size:
 *      { id: 'unique-id', type: 'yourwidget', x: 0, y: 0, width: 2, height: 2 }
 * 
 * ================================================================================
 * HOW TO REMOVE A WIDGET
 * ================================================================================
 * 
 * 1. REMOVE FROM index.js
 *    - Delete the export statement: export { YourWidget } from './YourWidget.js';
 *    - Delete the import statement: import { YourWidget } from './YourWidget.js';
 *    - Remove from WidgetRegistry: yourwidget: YourWidget
 * 
 * 2. DELETE THE WIDGET FILE
 *    - Delete src/widgets/YourWidget.js
 * 
 * 3. REMOVE STYLES (if any)
 *    - Delete any CSS rules for the widget from src/hellodev.css
 * 
 * 4. REMOVE FROM DEFAULT LAYOUT (if present)
 *    - Remove the widget entry from DEFAULT_STATE.widgets in src/defaultState.js
 * 
 * 5. NOTE: Existing user configurations with this widget type will gracefully
 *    fall back to WidgetBase (showing "Unknown widget")
 * 
 * ================================================================================
 */
export class WidgetBase {
  /**
   * Widget metadata for display in the UI.
   * Override in subclasses to provide widget-specific info.
   */
  static metadata = {
    name: 'Widget',
    icon: '📦',
    defaultSize: { width: 2, height: 2 }
  };

  constructor(config) {
    this.id = config.id;
    this.type = config.type;
    this.x = config.x ?? 0;
    this.y = config.y ?? 0;
    this.width = config.width ?? 1;
    this.height = config.height ?? 1;
    this.zIndex = config.zIndex ?? this.constructor.metadata?.defaultZIndex ?? 2;
    this.stretchFill = config.stretchFill ?? false;
    this.minimized = config.minimized ?? false;
    this.data = config.data || {};
    this.element = null;
  }

  /**
   * Get the configuration schema for this widget.
   * Override in subclasses to define configurable options.
   * 
   * Supported field types:
   * - 'string': Single line text input
   * - 'text': Multi-line text area
   * - 'number': Numeric input
   * - 'boolean': Checkbox/toggle
   * - 'select': Dropdown with options
   * - 'list': Array of objects with sub-fields
   * 
   * @returns {Array<Object>} Array of field definitions
   * @example
   * [
   *   { key: 'title', label: 'Title', type: 'string', default: 'My Widget' },
   *   { key: 'count', label: 'Count', type: 'number', default: 5 },
   *   { key: 'enabled', label: 'Enabled', type: 'boolean', default: true },
   *   { key: 'theme', label: 'Theme', type: 'select', options: ['light', 'dark'], default: 'dark' },
   *   { key: 'items', label: 'Items', type: 'list', fields: [
   *       { key: 'name', label: 'Name', type: 'string' },
   *       { key: 'value', label: 'Value', type: 'string' }
   *     ], default: []
   *   }
   * ]
   */
  getConfigSchema() {
    return [];
  }

  /**
   * Get the current configuration values.
   * @returns {Object} Current configuration key-value pairs
   */
  getConfig() {
    const schema = this.getConfigSchema();
    const config = {};
    for (const field of schema) {
      config[field.key] = this.data[field.key] ?? field.default;
    }
    return config;
  }

  /**
   * Set configuration values and update the widget.
   * @param {Object} values - Key-value pairs to set
   */
  setConfig(values) {
    const schema = this.getConfigSchema();
    const validKeys = new Set(schema.map(f => f.key));
    
    for (const [key, value] of Object.entries(values)) {
      if (validKeys.has(key)) {
        this.data[key] = value;
      }
    }
  }

  /**
   * Check if this widget has configurable options.
   * @returns {boolean} True if widget has configuration options
   */
  hasConfig() {
    return this.getConfigSchema().length > 0;
  }

  /**
   * Apply grid position and size to the widget element.
   * When stretchFill is enabled, calculates remaining columns/rows from the
   * dashboard grid so the widget stretches to fill the available space.
   */
  applyGridPosition() {
    const el = this.element;
    if (!el) return;

    const effectiveHeight = this.minimized ? 1 : this.height;

    if (this.stretchFill) {
      el.classList.add('widget-stretch-fill');
      // Grid placement is ignored when stretch-fill is active (uses absolute positioning)
    } else {
      el.classList.remove('widget-stretch-fill');
      el.style.gridColumn = `${this.x + 1} / span ${this.width}`;
      el.style.gridRow = `${this.y + 1} / span ${effectiveHeight}`;
    }
  }

  /**
   * Get the widget content HTML
   * @returns {string} HTML content for the widget
   */
  getContent() {
    return '<p>Unknown widget</p>';
  }

  /**
   * Setup widget-specific behavior after DOM insertion
   * @param {HTMLElement} element - The widget's DOM element
   */
  setupBehavior(element) {
    // Override in subclasses for custom behavior
  }

  /**
   * Clean up widget resources (intervals, listeners, etc.)
   * Called when widget is removed from the dashboard.
   */
  destroy() {
    this.restoreFromMaximize();
    // Override in subclasses that need cleanup
  }

  /**
   * Toggle the widget between maximized (full-screen) and normal state.
   * When maximized, a backdrop overlay provides light-dismiss behavior.
   */
  toggleMaximize() {
    if (this.element?.classList.contains('widget-maximized')) {
      this.restoreFromMaximize();
    } else {
      this.maximize();
    }
  }

  /**
   * Maximize the widget to fill the viewport with a high z-index.
   */
  maximize() {
    const el = this.element;
    if (!el) return;

    // Save original grid position and z-index for restore
    this._savedGridColumn = el.style.gridColumn;
    this._savedGridRow = el.style.gridRow;
    this._savedZIndex = el.style.zIndex;

    // Create backdrop overlay for light dismiss
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'widget-maximize-backdrop';
    this._backdrop.addEventListener('click', () => this.restoreFromMaximize());

    // Also dismiss on Escape key
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.restoreFromMaximize();
    };
    document.addEventListener('keydown', this._escHandler);

    el.parentElement.appendChild(this._backdrop);
    el.classList.add('widget-maximized');
    // Clear inline grid styles so the CSS class rules take effect
    el.style.gridColumn = '';
    el.style.gridRow = '';
    el.style.zIndex = '10000';

    // Update the button to show restore icon
    const btn = el.querySelector('.widget-control.maximize');
    if (btn) {
      btn.textContent = '⧉';
      btn.title = 'Restore';
    }
  }

  /**
   * Restore the widget from maximized state to its normal grid position.
   */
  restoreFromMaximize() {
    const el = this.element;
    if (!el || !el.classList.contains('widget-maximized')) return;

    el.classList.remove('widget-maximized');
    el.style.gridColumn = this._savedGridColumn;
    el.style.gridRow = this._savedGridRow;
    el.style.zIndex = this._savedZIndex ?? this.zIndex;

    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    // Restore the button icon
    const btn = el.querySelector('.widget-control.maximize');
    if (btn) {
      btn.textContent = '⛶';
      btn.title = 'Maximize';
    }
  }

  /**
   * Toggle the widget between normal height and minimized (rolled-up) state.
   * The minimized flag is persisted; the original height is never mutated.
   */
  toggleMinimize() {
    const el = this.element;
    if (!el) return;

    this.minimized = !this.minimized;

    if (this.minimized) {
      el.classList.add('widget-minimized');
      const btn = el.querySelector('.widget-control.minimize');
      if (btn) { btn.textContent = '\u25A3'; btn.title = 'Restore'; }
    } else {
      el.classList.remove('widget-minimized');
      const btn = el.querySelector('.widget-control.minimize');
      if (btn) { btn.textContent = '\u2581'; btn.title = 'Minimize'; }
    }

    this.applyGridPosition();
  }

  /**
   * Serialize the widget to a plain object for storage
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      zIndex: this.zIndex,
      stretchFill: this.stretchFill,
      minimized: this.minimized,
      data: this.data
    };
  }

  /**
   * Create the DOM element for this widget
   * @param {Function} removeWidget - Callback to remove the widget
   * @param {Function} resizeWidget - Callback to resize widget
   * @param {Function} openWidgetConfig - Callback to open widget configuration dialog
   * @returns {HTMLElement} The widget element
   */
  createElement(removeWidget, resizeWidget, openWidgetConfig) {
    const el = document.createElement('div');
    el.className = `widget widget-${this.type}`;
    el.dataset.id = this.id;
    el.draggable = false;
    
    this.element = el;

    // Set grid position, size, and stacking order using CSS grid placement
    el.style.zIndex = this.zIndex;
    this.applyGridPosition();

    this._resizeWidget = resizeWidget;

    el.innerHTML = `
      <button class="widget-control drag-handle" title="Drag to move">✥</button>
      <button class="widget-control minimize" title="${this.minimized ? 'Restore' : 'Minimize'}">${this.minimized ? '\u25A3' : '\u2581'}</button>
      <button class="widget-control maximize" title="Maximize">⛶</button>
      <button class="widget-control config" title="Configure">⚙</button>
      <button class="widget-control resize-handle" title="Drag to resize">⤢</button>
      <div class="widget-content">
        ${this.getContent()}
      </div>
    `;

    if (this.minimized) {
      el.classList.add('widget-minimized');
    }

    this.setupBehavior(el);

    // Setup control buttons
    el.querySelector('.widget-control.minimize').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    el.querySelector('.widget-control.maximize').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize();
    });

    el.querySelector('.widget-control.config').addEventListener('click', (e) => {
      e.stopPropagation();
      openWidgetConfig(this.id);
    });

    // Setup resize handle (pointer events for mouse + touch support)
    const resizeHandle = el.querySelector('.widget-control.resize-handle');
    resizeHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resizeHandle.setPointerCapture(e.pointerId);
      el.classList.add('resizing');

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = this.width;
      const startHeight = this.height;

      const onPointerMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        // Calculate new size based on drag distance
        const newWidth = Math.max(1, startWidth + Math.round(deltaX / (GRID_CELL_SIZE + GRID_GAP)));
        const newHeight = Math.max(1, startHeight + Math.round(deltaY / (GRID_CELL_SIZE + GRID_GAP)));

        // Update visual preview
        el.style.gridColumn = `${this.x + 1} / span ${newWidth}`;
        el.style.gridRow = `${this.y + 1} / span ${newHeight}`;
      };

      const onPointerUp = (upEvent) => {
        resizeHandle.removeEventListener('pointermove', onPointerMove);
        resizeHandle.removeEventListener('pointerup', onPointerUp);
        el.classList.remove('resizing');

        const deltaX = upEvent.clientX - startX;
        const deltaY = upEvent.clientY - startY;

        const newWidth = Math.max(1, startWidth + Math.round(deltaX / (GRID_CELL_SIZE + GRID_GAP)));
        const newHeight = Math.max(1, startHeight + Math.round(deltaY / (GRID_CELL_SIZE + GRID_GAP)));

        if (newWidth !== startWidth || newHeight !== startHeight) {
          resizeWidget(this.id, newWidth, newHeight);
        }
      };

      resizeHandle.addEventListener('pointermove', onPointerMove);
      resizeHandle.addEventListener('pointerup', onPointerUp);
    });

    return el;
  }
}
