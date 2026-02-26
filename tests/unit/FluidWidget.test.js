import { describe, it, expect } from 'vitest';
import { FluidWidget } from '../../src/widgets/FluidWidget.js';

describe('FluidWidget', () => {
  describe('static metadata', () => {
    it('has correct metadata', () => {
      expect(FluidWidget.metadata.name).toBe('Fluid');
      expect(FluidWidget.metadata.icon).toBe('🌊');
      expect(FluidWidget.metadata.defaultSize).toEqual({ width: 3, height: 3 });
      expect(FluidWidget.metadata.defaultZIndex).toBe(0);
    });
  });

  describe('constructor', () => {
    it('sets type to fluid', () => {
      const widget = new FluidWidget({ id: 'f1', type: 'fluid', data: {} });
      expect(widget.type).toBe('fluid');
    });
  });

  describe('getContent', () => {
    it('returns a fluid container with 5 blobs', () => {
      const widget = new FluidWidget({ id: 'f2', type: 'fluid', data: {} });
      const html = widget.getContent();
      expect(html).toContain('fluid-container');
      expect(html).toContain('fluid-blob-1');
      expect(html).toContain('fluid-blob-2');
      expect(html).toContain('fluid-blob-3');
      expect(html).toContain('fluid-blob-4');
      expect(html).toContain('fluid-blob-5');
    });

    it('contains exactly 5 blob elements', () => {
      const widget = new FluidWidget({ id: 'f3', type: 'fluid', data: {} });
      const html = widget.getContent();
      const blobCount = (html.match(/fluid-blob fluid-blob-\d/g) || []).length;
      expect(blobCount).toBe(5);
    });
  });
});
