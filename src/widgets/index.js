export { WidgetBase } from './WidgetBase.js';
export { ClockWidget } from './ClockWidget.js';
export { SearchWidget } from './SearchWidget.js';
export { MarkdownWidget } from './MarkdownWidget.js';
export { ADOPRWidget } from './ADOPRWidget.js';
export { ADOBugsWidget } from './ADOBugsWidget.js';
export { FrameWidget } from './FrameWidget.js';
export { GerritCLWidget } from './GerritCLWidget.js';
export { FluidWidget } from './FluidWidget.js';
export { ChromiumBugsWidget } from './ChromiumBugsWidget.js';
export { GitHubPRWidget } from './GitHubPRWidget.js';
export { GitHubIssuesWidget } from './GitHubIssuesWidget.js';
export { TopSitesWidget } from './TopSitesWidget.js';

import { WidgetBase } from './WidgetBase.js';
import { ClockWidget } from './ClockWidget.js';
import { SearchWidget } from './SearchWidget.js';
import { MarkdownWidget } from './MarkdownWidget.js';
import { ADOPRWidget } from './ADOPRWidget.js';
import { ADOBugsWidget } from './ADOBugsWidget.js';
import { FrameWidget } from './FrameWidget.js';
import { GerritCLWidget } from './GerritCLWidget.js';
import { FluidWidget } from './FluidWidget.js';
import { ChromiumBugsWidget } from './ChromiumBugsWidget.js';
import { GitHubPRWidget } from './GitHubPRWidget.js';
import { GitHubIssuesWidget } from './GitHubIssuesWidget.js';
import { TopSitesWidget } from './TopSitesWidget.js';

// Widget factory - creates the appropriate widget class instance
export const WidgetRegistry = {
  clock: ClockWidget,
  search: SearchWidget,
  markdown: MarkdownWidget,
  adopr: ADOPRWidget,
  adobugs: ADOBugsWidget,
  frame: FrameWidget,
  gerritcl: GerritCLWidget,
  fluid: FluidWidget,
  chromiumbug: ChromiumBugsWidget,
  githubpr: GitHubPRWidget,
  githubissues: GitHubIssuesWidget,
  topsites: TopSitesWidget
};

export function createWidget(config) {
  const WidgetClass = WidgetRegistry[config.type] || WidgetBase;
  return new WidgetClass(config);
}
