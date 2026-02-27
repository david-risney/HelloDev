// Action Links — parse and handle fragment URLs that trigger HelloDev UI actions.
//
// Supported actions:
//   #action=add&name=<pack-or-filter>  — open the Add Widget flyout
//     If `name` exactly matches a widget pack name, opens the pack prompt directly.
//     Otherwise opens the Add Widget flyout with `name` as the filter text.
//   #action=appearance                 — open the Appearance flyout

import { WidgetPacks } from './widgetPacks.js';

/**
 * Parse a fragment URL into an action descriptor.
 * @param {string} hash - Fragment string, e.g. '#action=add&name=ado+dev'
 * @returns {{ action: string, params: URLSearchParams } | null}
 */
export function parseActionUrl(hash) {
  if (!hash || !hash.startsWith('#')) return null;
  const params = new URLSearchParams(hash.slice(1));
  const action = params.get('action');
  if (!action) return null;
  return { action, params };
}

/**
 * Find a widget pack whose name matches (case-insensitive, exact match).
 * @param {string} name - Display name to match, e.g. 'ado dev'
 * @returns {object | null} The matching WidgetPack or null
 */
export function findPackByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return WidgetPacks.find(p => p.name.toLowerCase() === lower) || null;
}
