// Drag-and-drop management for the dashboard grid

import { GRID_CELL_SIZE, GRID_GAP, DASHBOARD_PADDING } from './constants.js';

// Calculate grid position from a mouse/drag event relative to the dashboard
export function getGridPositionFromEvent(dashboardEl, e) {
  const rect = dashboardEl.getBoundingClientRect();

  const relativeX = e.clientX - rect.left - DASHBOARD_PADDING;
  const relativeY = e.clientY - rect.top - DASHBOARD_PADDING;

  const x = Math.max(0, Math.floor(relativeX / (GRID_CELL_SIZE + GRID_GAP)));
  const y = Math.max(0, Math.floor(relativeY / (GRID_CELL_SIZE + GRID_GAP)));

  return { x, y };
}

// Show or update the drop indicator at a grid position with given dimensions
function updateDropIndicator(dashboardEl, x, y, width = 1, height = 1) {
  let indicator = dashboardEl.querySelector('.drop-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    dashboardEl.appendChild(indicator);
  }
  indicator.style.gridColumn = `${x + 1} / span ${width}`;
  indicator.style.gridRow = `${y + 1} / span ${height}`;
}

// Remove the drop indicator from the dashboard
function removeDropIndicator(dashboardEl) {
  const indicator = dashboardEl.querySelector('.drop-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Setup drag-and-drop event listeners on the dashboard element.
// state: the shared dashboard state object
// moveWidget: callback(id, x, y) to move a widget to a new position
export function setupDashboardDragDrop(dashboardEl, state, moveWidget) {
  dashboardEl.addEventListener('dragover', (e) => {
    if (!state.editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Track which widget is being dragged
    if (!state.draggingWidget) {
      const draggingEl = dashboardEl.querySelector('.widget.dragging');
      if (draggingEl) {
        state.draggingWidget = state.widgets.find(w => w.id === draggingEl.dataset.id);
      }
    }

    // Show drop indicator with widget dimensions
    const pos = getGridPositionFromEvent(dashboardEl, e);
    const width = state.draggingWidget?.width ?? 1;
    const height = state.draggingWidget?.height ?? 1;
    updateDropIndicator(dashboardEl, pos.x, pos.y, width, height);
  });

  dashboardEl.addEventListener('dragleave', (e) => {
    // Only remove indicator if leaving the dashboard entirely
    if (!dashboardEl.contains(e.relatedTarget)) {
      removeDropIndicator(dashboardEl);
      state.draggingWidget = null;
    }
  });

  dashboardEl.addEventListener('drop', (e) => {
    if (!state.editMode) return;
    e.preventDefault();
    removeDropIndicator(dashboardEl);
    state.draggingWidget = null;

    const widgetId = e.dataTransfer.getData('text/plain');
    const pos = getGridPositionFromEvent(dashboardEl, e);
    moveWidget(widgetId, pos.x, pos.y);
  });
}
