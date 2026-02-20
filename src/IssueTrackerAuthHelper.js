/**
 * Google Issue Tracker Authentication Helper
 * Manages token acquisition for Issue Tracker API widgets.
 *
 * Supports two authentication modes:
 *   1. "oauth"  — chrome.identity.getAuthToken() using the Chrome profile's Google account.
 *                 Chrome handles token caching and refresh automatically.
 *                 Requires the extension to be registered in the Chrome Web Store developer
 *                 dashboard (does not need to be published) and an oauth2 section in manifest.json.
 *   2. "token"  — Manual Bearer token (e.g. copied from browser DevTools on issues.chromium.org)
 */

import { PromiseCoalescer } from './PromiseCoalescer.js';

const SCOPES = ['https://www.googleapis.com/auth/buganizer'];

const tokenFetchCoalescer = new PromiseCoalescer();

class IssueTrackerAuthHelper {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get a valid access token.
   * @param {"oauth"|"token"} mode
   * @param {{ manualToken?: string }} [credentials]
   * @returns {Promise<string>} Bearer token
   */
  static async getToken(mode, credentials) {
    if (mode === 'token') {
      if (!credentials?.manualToken) {
        throw new Error('No access token provided. Paste a token in the widget settings.');
      }
      return credentials.manualToken;
    }

    // OAuth mode via chrome.identity.getAuthToken
    const { promise, resolve, reject, isFirst } = tokenFetchCoalescer.acquire();

    if (isFirst) {
      try {
        const token = await this.acquireToken();
        resolve(token);
      } catch (e) {
        reject(e);
      }
    }

    return promise;
  }

  /**
   * Handle an auth error by revoking the cached token so the next
   * call to getToken() forces a fresh interactive consent.
   */
  static handleAuthError(errorMessage) {
    const authKeywords = ['login', '401', 'authentication', 'token', 'unauthorized', '403'];
    const isAuthError = authKeywords.some(k => errorMessage.toLowerCase().includes(k));
    if (isAuthError) {
      this.removeCachedToken();
    }
    return isAuthError;
  }

  // ---------------------------------------------------------------------------
  // Token acquisition via chrome.identity
  // ---------------------------------------------------------------------------

  static async acquireToken() {
    try {
      const result = await chrome.identity.getAuthToken({
        interactive: true,
        scopes: SCOPES
      });
      if (!result?.token) {
        throw new Error('No token received. Authentication may have been cancelled.');
      }
      return result.token;
    } catch (err) {
      if (err.message?.includes('canceled') || err.message?.includes('cancelled')) {
        throw new Error('Authentication was cancelled by the user.');
      }
      throw new Error(`Google authentication failed: ${err.message || err}`);
    }
  }

  /**
   * Remove the cached token so the next getAuthToken call fetches a fresh one.
   * Also revokes it server-side so it can't be reused.
   */
  static async removeCachedToken() {
    try {
      const result = await chrome.identity.getAuthToken({ interactive: false, scopes: SCOPES });
      if (result?.token) {
        await chrome.identity.removeCachedAuthToken({ token: result.token });
        // Also revoke server-side
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${result.token}`).catch(() => {});
      }
    } catch {
      // No cached token to remove
    }
  }
}

export { IssueTrackerAuthHelper };
