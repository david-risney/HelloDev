import { WidgetBase } from './WidgetBase.js';

/**
 * Fluid gradient widget - displays slowly moving fluid blobs
 * with colors matching the logo gradient (accent hue ±56°).
 * Pure CSS implementation - no JS animation.
 */
export class FluidWidget extends WidgetBase {
  static metadata = {
    name: 'Fluid',
    icon: '🌊',
    defaultSize: { width: 3, height: 3 }
  };

  constructor(config) {
    super({ ...config, type: 'fluid' });
  }

  getContent() {
    return `
      <div class="fluid-container">
        <div class="fluid-blob fluid-blob-1"></div>
        <div class="fluid-blob fluid-blob-2"></div>
        <div class="fluid-blob fluid-blob-3"></div>
        <div class="fluid-blob fluid-blob-4"></div>
        <div class="fluid-blob fluid-blob-5"></div>
      </div>
    `;
  }
}
