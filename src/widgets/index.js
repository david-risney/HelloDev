export { WidgetBase } from './WidgetBase.js';
export { ClockWidget } from './ClockWidget.js';
export { SearchWidget } from './SearchWidget.js';
export { MarkdownWidget } from './MarkdownWidget.js';
export { ADOPRWidget } from './ADOPRWidget.js';
export { FrameWidget } from './FrameWidget.js';

import { WidgetBase } from './WidgetBase.js';
import { ClockWidget } from './ClockWidget.js';
import { SearchWidget } from './SearchWidget.js';
import { MarkdownWidget } from './MarkdownWidget.js';
import { ADOPRWidget } from './ADOPRWidget.js';
import { FrameWidget } from './FrameWidget.js';

// Widget factory - creates the appropriate widget class instance
export const WidgetRegistry = {
  clock: ClockWidget,
  search: SearchWidget,
  markdown: MarkdownWidget,
  adopr: ADOPRWidget,
  frame: FrameWidget
};

export function createWidget(config) {
  const WidgetClass = WidgetRegistry[config.type] || WidgetBase;
  return new WidgetClass(config);
}
