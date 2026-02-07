/**
 * Base class for all widgets
 */
export class WidgetBase {
  /**
   * Widget metadata for display in the UI.
   * Override in subclasses to provide widget-specific info.
   */
  static metadata = {
    name: 'Widget',
    icon: '📦'
  };

  constructor(config) {
    this.id = config.id;
    this.type = config.type;
    this.x = config.x ?? 0;
    this.y = config.y ?? 0;
    this.width = config.width ?? 1;
    this.height = config.height ?? 1;
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
    // Override in subclasses that need cleanup
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
    el.draggable = true;
    
    // Set grid position and size using CSS grid placement
    el.style.gridColumn = `${this.x + 1} / span ${this.width}`;
    el.style.gridRow = `${this.y + 1} / span ${this.height}`;

    el.innerHTML = `
      <button class="widget-control drag-handle" title="Drag to move">✜</button>
      <button class="widget-control config" title="Configure">⚙</button>
      <button class="widget-control resize-handle" title="Drag to resize">⤢</button>
      <div class="widget-content">
        ${this.getContent()}
      </div>
    `;

    this.element = el;
    this.setupBehavior(el);

    // Setup control buttons
    el.querySelector('.widget-control.config').addEventListener('click', (e) => {
      e.stopPropagation();
      openWidgetConfig(this.id);
    });

    // Setup drag and drop for moving
    el.addEventListener('dragstart', (e) => {
      // Don't start drag if resizing
      if (el.classList.contains('resizing')) {
        e.preventDefault();
        return;
      }
      el.classList.add('dragging');
      e.dataTransfer.setData('text/plain', this.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
    });

    // Setup resize handle drag
    const resizeHandle = el.querySelector('.widget-control.resize-handle');
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.draggable = false; // Disable drag while resizing
      el.classList.add('resizing');
      
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = this.width;
      const startHeight = this.height;
      
      const onMouseMove = (moveEvent) => {
        const cellSize = 160; // GRID_CELL_SIZE
        const gap = 16; // grid gap
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        
        // Calculate new size based on drag distance
        const newWidth = Math.max(1, startWidth + Math.round(deltaX / (cellSize + gap)));
        const newHeight = Math.max(1, startHeight + Math.round(deltaY / (cellSize + gap)));
        
        // Update visual preview
        el.style.gridColumn = `${this.x + 1} / span ${newWidth}`;
        el.style.gridRow = `${this.y + 1} / span ${newHeight}`;
      };
      
      const onMouseUp = (upEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        el.classList.remove('resizing');
        el.draggable = true; // Re-enable drag
        
        const cellSize = 160;
        const gap = 16;
        const deltaX = upEvent.clientX - startX;
        const deltaY = upEvent.clientY - startY;
        
        const newWidth = Math.max(1, startWidth + Math.round(deltaX / (cellSize + gap)));
        const newHeight = Math.max(1, startHeight + Math.round(deltaY / (cellSize + gap)));
        
        if (newWidth !== startWidth || newHeight !== startHeight) {
          resizeWidget(this.id, newWidth, newHeight);
        }
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    return el;
  }
}
