export { WidgetBase } from './WidgetBase.js';
export { ADOWidgetBase } from './ADOWidgetBase.js';
export { ClockWidget } from './ClockWidget.js';
export { SearchWidget } from './SearchWidget.js';
export { MarkdownWidget } from './MarkdownWidget.js';
export { ADOPRWidget } from './ADOPRWidget.js';
export { ADOBugsWidget } from './ADOBugsWidget.js';
export { FrameWidget } from './FrameWidget.js';
export { GerritCLWidget } from './GerritCLWidget.js';
export { FluidWidget } from './FluidWidget.js';

import { WidgetBase } from './WidgetBase.js';
import { ClockWidget } from './ClockWidget.js';
import { SearchWidget } from './SearchWidget.js';
import { MarkdownWidget } from './MarkdownWidget.js';
import { ADOPRWidget } from './ADOPRWidget.js';
import { ADOBugsWidget } from './ADOBugsWidget.js';
import { FrameWidget } from './FrameWidget.js';
import { GerritCLWidget } from './GerritCLWidget.js';
import { FluidWidget } from './FluidWidget.js';

// Widget factory - creates the appropriate widget class instance
export const WidgetRegistry = {
  clock: ClockWidget,
  search: SearchWidget,
  markdown: MarkdownWidget,
  adopr: ADOPRWidget,
  adobugs: ADOBugsWidget,
  frame: FrameWidget,
  gerritcl: GerritCLWidget,
  fluid: FluidWidget
};

export function createWidget(config) {
  const WidgetClass = WidgetRegistry[config.type] || WidgetBase;
  return new WidgetClass(config);
}
