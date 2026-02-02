export { WidgetBase } from './WidgetBase.js';
export { ClockWidget } from './ClockWidget.js';
export { GreetingWidget } from './GreetingWidget.js';
export { SearchWidget } from './SearchWidget.js';
export { NotesWidget } from './NotesWidget.js';
export { LinksWidget } from './LinksWidget.js';
export { MarkdownWidget } from './MarkdownWidget.js';

import { WidgetBase } from './WidgetBase.js';
import { ClockWidget } from './ClockWidget.js';
import { GreetingWidget } from './GreetingWidget.js';
import { SearchWidget } from './SearchWidget.js';
import { NotesWidget } from './NotesWidget.js';
import { LinksWidget } from './LinksWidget.js';
import { MarkdownWidget } from './MarkdownWidget.js';

// Widget factory - creates the appropriate widget class instance
export const WidgetRegistry = {
  clock: ClockWidget,
  greeting: GreetingWidget,
  search: SearchWidget,
  notes: NotesWidget,
  links: LinksWidget,
  markdown: MarkdownWidget
};

export function createWidget(config) {
  const WidgetClass = WidgetRegistry[config.type] || WidgetBase;
  return new WidgetClass(config);
}
