import { describe, it, expect } from 'vitest';
import { getGridPosition } from '../../src/dragDrop.js';
import { GRID_CELL_SIZE, GRID_GAP, DASHBOARD_PADDING } from '../../src/constants.js';

describe('dragDrop', () => {
  describe('getGridPosition', () => {
    // Create a mock dashboard element with a known bounding rect
    function makeDashboard(left = 0, top = 0) {
      return {
        getBoundingClientRect: () => ({ left, top, right: left + 1000, bottom: top + 800 })
      };
    }

    const cellStep = GRID_CELL_SIZE + GRID_GAP; // 88px per cell

    it('returns (0, 0) for the top-left corner of the grid', () => {
      const dash = makeDashboard(0, 0);
      const pos = getGridPosition(dash, DASHBOARD_PADDING, DASHBOARD_PADDING);
      expect(pos).toEqual({ x: 0, y: 0 });
    });

    it('calculates correct grid column from x coordinate', () => {
      const dash = makeDashboard(0, 0);
      // One cell to the right: padding + one full cell step
      const pos = getGridPosition(dash, DASHBOARD_PADDING + cellStep, DASHBOARD_PADDING);
      expect(pos.x).toBe(1);
    });

    it('calculates correct grid row from y coordinate', () => {
      const dash = makeDashboard(0, 0);
      const pos = getGridPosition(dash, DASHBOARD_PADDING, DASHBOARD_PADDING + 2 * cellStep);
      expect(pos.y).toBe(2);
    });

    it('accounts for dashboard offset (bounding rect)', () => {
      const dash = makeDashboard(100, 50);
      // Client coord = dashboard left + padding + cellStep*3
      const clientX = 100 + DASHBOARD_PADDING + 3 * cellStep;
      const clientY = 50 + DASHBOARD_PADDING + 1 * cellStep;
      const pos = getGridPosition(dash, clientX, clientY);
      expect(pos).toEqual({ x: 3, y: 1 });
    });

    it('clamps to 0 for coordinates before the grid', () => {
      const dash = makeDashboard(100, 100);
      // Client coords left of dashboard → negative relative position
      const pos = getGridPosition(dash, 0, 0);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('floors to the correct cell for mid-cell coordinates', () => {
      const dash = makeDashboard(0, 0);
      // Middle of cell (1,1): padding + 1*step + half a cell
      const midX = DASHBOARD_PADDING + cellStep + GRID_CELL_SIZE / 2;
      const midY = DASHBOARD_PADDING + cellStep + GRID_CELL_SIZE / 2;
      const pos = getGridPosition(dash, midX, midY);
      expect(pos).toEqual({ x: 1, y: 1 });
    });

    it('handles larger grid positions', () => {
      const dash = makeDashboard(0, 0);
      const pos = getGridPosition(dash, DASHBOARD_PADDING + 10 * cellStep, DASHBOARD_PADDING + 5 * cellStep);
      expect(pos).toEqual({ x: 10, y: 5 });
    });
  });
});
