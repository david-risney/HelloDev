// Drag-and-drop management for the dashboard grid (pointer events for mouse + touch)

import { GRID_CELL_SIZE, GRID_GAP, DASHBOARD_PADDING } from './constants.js';

// Calculate grid position from a pre-computed bounding rect
function getGridPositionFromRect(rect, clientX, clientY) {
  const relativeX = clientX - rect.left - DASHBOARD_PADDING;
  const relativeY = clientY - rect.top - DASHBOARD_PADDING;

  const x = Math.max(0, Math.floor(relativeX / (GRID_CELL_SIZE + GRID_GAP)));
  const y = Math.max(0, Math.floor(relativeY / (GRID_CELL_SIZE + GRID_GAP)));

  return { x, y };
}

// Calculate grid position from client coordinates relative to the dashboard
export function getGridPosition(dashboardEl, clientX, clientY) {
  const rect = dashboardEl.getBoundingClientRect();
  return getGridPositionFromRect(rect, clientX, clientY);
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

// Setup pointer-based drag on a widget's drag handle.
// dashboardEl: the dashboard grid element
// state: shared dashboard state (checks editMode)
// moveWidget: callback(id, x, y) to move a widget
export function setupWidgetDrag(dragHandle, widgetEl, widget, dashboardEl, state, moveWidget) {
  dragHandle.addEventListener('pointerdown', (e) => {
    if (!state.editMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragHandle.setPointerCapture(e.pointerId);
    widgetEl.classList.add('dragging');

    // Cache the bounding rect once at drag start to avoid layout thrashing
    const cachedRect = dashboardEl.getBoundingClientRect();

    const onPointerMove = (moveEvent) => {
      const pos = getGridPositionFromRect(cachedRect, moveEvent.clientX, moveEvent.clientY);
      updateDropIndicator(dashboardEl, pos.x, pos.y, widget.width, widget.height);
    };

    const onPointerUp = (upEvent) => {
      dragHandle.removeEventListener('pointermove', onPointerMove);
      dragHandle.removeEventListener('pointerup', onPointerUp);
      widgetEl.classList.remove('dragging');
      removeDropIndicator(dashboardEl);

      const pos = getGridPositionFromRect(cachedRect, upEvent.clientX, upEvent.clientY);
      if (pos.x !== widget.x || pos.y !== widget.y) {
        moveWidget(widget.id, pos.x, pos.y);
      }
    };

    dragHandle.addEventListener('pointermove', onPointerMove);
    dragHandle.addEventListener('pointerup', onPointerUp);
  });
}
