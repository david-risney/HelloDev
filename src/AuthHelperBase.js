/**
 * Base class for authentication helpers that use localStorage token caching
 * and PromiseCoalescer for concurrent request deduplication.
 *
 * Subclasses must define:
 *   - static TOKEN_CACHE_KEY  — the localStorage key
 *   - static LOG_PREFIX        — prefix for console.error messages
 *   - static async _acquireToken() — fetch a fresh token, call this.cacheToken(),
 *       and return the accessToken string
 */
import { PromiseCoalescer } from './PromiseCoalescer.js';

const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export class AuthHelperBase {
  // --- Cache ---

  static getCachedToken() {
    try {
      const cached = localStorage.getItem(this.TOKEN_CACHE_KEY);
      if (!cached) return null;
      const data = JSON.parse(cached);
      if (!data.accessToken || !data.expiresOn) return null;
      return data;
    } catch (e) {
      console.error(`${this.LOG_PREFIX} Error reading cache:`, e);
      return null;
    }
  }

  static isTokenValid() {
    const cached = this.getCachedToken();
    if (!cached) return false;
    const expiryTime = new Date(cached.expiresOn).getTime();
    return (expiryTime - Date.now()) > TOKEN_EXPIRY_BUFFER_MS;
  }

  static getValidToken() {
    if (!this.isTokenValid()) return null;
    return this.getCachedToken()?.accessToken || null;
  }

  /**
   * Save token data to localStorage.
   * @param {object} data - Must include accessToken and expiresOn; may include
   *   additional fields (e.g. refreshToken for OAuth helpers).
   */
  static cacheToken(data) {
    try {
      localStorage.setItem(this.TOKEN_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error(`${this.LOG_PREFIX} Cache save error:`, e);
    }
  }

  static clearCache() {
    try {
      localStorage.removeItem(this.TOKEN_CACHE_KEY);
    } catch (e) {
      console.error(`${this.LOG_PREFIX} Cache clear error:`, e);
    }
  }

  // --- Token retrieval ---

  /** @type {PromiseCoalescer | null} */
  static _coalescer = null;

  static _getCoalescer() {
    if (!this.hasOwnProperty('_coalescer') || !this._coalescer) {
      this._coalescer = new PromiseCoalescer();
    }
    return this._coalescer;
  }

  /**
   * Get a valid access token, refreshing if needed.
   * Uses cached token if valid, otherwise calls _acquireToken().
   * Concurrent calls are coalesced to a single acquisition.
   * @returns {Promise<string>}
   */
  static async getToken() {
    const cachedToken = this.getValidToken();
    if (cachedToken) return cachedToken;

    const coalescer = this._getCoalescer();
    const { promise, resolve, reject, isFirst } = coalescer.acquire();

    if (isFirst) {
      try {
        const token = await this._acquireToken();
        resolve(token);
      } catch (e) {
        reject(e);
      }
    }

    return promise;
  }

  /**
   * Subclasses implement this to perform the actual token acquisition.
   * Must call this.cacheToken() and return the accessToken string.
   * @returns {Promise<string>}
   */
  static async _acquireToken() {
    throw new Error('Subclasses must implement _acquireToken()');
  }

  // --- Error handling ---

  /**
   * Detect auth-related errors by keyword matching and clear the cache.
   * This is a last-resort heuristic; prefer handling HTTP 401 status directly.
   * @param {string} errorMessage
   * @returns {boolean} True if it was an auth error
   */
  static handleAuthError(errorMessage) {
    if (!errorMessage) return false;
    const lower = errorMessage.toLowerCase();

    const isAuthError =
      lower.includes('401') ||
      lower.includes('unauthorized') ||
      lower.includes('authentication failed') ||
      lower.includes('az login') ||
      lower.includes('sign in');

    if (isAuthError) {
      this.clearCache();
    }
    return isAuthError;
  }

  // --- OAuth2 / PKCE helpers ---

  /**
   * Launch an interactive OAuth2 flow via chrome.identity.launchWebAuthFlow.
   * @param {string} authUrl - The authorization URL
   * @returns {Promise<string>} The redirect URL containing the auth code
   */
  static launchAuthFlow(authUrl) {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!redirectUrl) {
            reject(new Error('Authentication was cancelled.'));
          } else {
            resolve(redirectUrl);
          }
        }
      );
    });
  }

  /**
   * Extract the authorization code from an OAuth2 redirect URL.
   * @param {string} redirectUrl
   * @returns {string} The authorization code
   */
  static extractAuthCode(redirectUrl) {
    const url = new URL(redirectUrl);
    const error = url.searchParams.get('error');
    if (error) {
      throw new Error(url.searchParams.get('error_description') || error);
    }
    const code = url.searchParams.get('code');
    if (!code) {
      throw new Error('No authorization code received.');
    }
    return code;
  }

  /**
   * Generate a random PKCE code verifier.
   * @returns {string} Base64url-encoded code verifier
   */
  static generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * Generate a PKCE code challenge from a code verifier (S256).
   * @param {string} codeVerifier
   * @returns {Promise<string>} Base64url-encoded code challenge
   */
  static async generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  /**
   * Base64url-encode a byte array.
   * @param {Uint8Array} buffer
   * @returns {string}
   */
  static base64UrlEncode(buffer) {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
