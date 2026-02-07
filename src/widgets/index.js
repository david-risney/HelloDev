export { WidgetBase } from './WidgetBase.js';
export { ClockWidget } from './ClockWidget.js';
export { SearchWidget } from './SearchWidget.js';
export { NotesWidget } from './NotesWidget.js';
export { MarkdownWidget } from './MarkdownWidget.js';
export { ADOPRWidget } from './ADOPRWidget.js';

import { WidgetBase } from './WidgetBase.js';
import { ClockWidget } from './ClockWidget.js';
import { SearchWidget } from './SearchWidget.js';
import { NotesWidget } from './NotesWidget.js';
import { MarkdownWidget } from './MarkdownWidget.js';
import { ADOPRWidget } from './ADOPRWidget.js';

// Widget factory - creates the appropriate widget class instance
export const WidgetRegistry = {
  clock: ClockWidget,
  search: SearchWidget,
  notes: NotesWidget,
  markdown: MarkdownWidget,
  adopr: ADOPRWidget
};

export function createWidget(config) {
  const WidgetClass = WidgetRegistry[config.type] || WidgetBase;
  return new WidgetClass(config);
}
