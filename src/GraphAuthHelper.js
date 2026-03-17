/**
 * Microsoft Graph Authentication Helper
 * Uses OAuth2 Authorization Code flow with PKCE via chrome.identity.launchWebAuthFlow.
 *
 * Requires a custom Azure AD (Entra ID) app registration with:
 *   - Redirect URI: chrome.identity.getRedirectURL()  (platform: SPA)
 *   - Delegated permission: Microsoft Graph > Calendars.ReadBasic
 */
import { AuthHelperBase } from './AuthHelperBase.js';
import { GRAPH_CLIENT_ID } from './secrets.js';

const CLIENT_ID = GRAPH_CLIENT_ID;
const TENANT_ID = 'common';
const AUTH_ENDPOINT = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const SCOPES = 'Calendars.ReadBasic offline_access';
const REDIRECT_URI = chrome.identity.getRedirectURL();

class GraphAuthHelper extends AuthHelperBase {
  static TOKEN_CACHE_KEY = 'graph_auth_token';
  static LOG_PREFIX = '[GraphAuthHelper]';
  static REFRESH_TOKEN_SESSION_KEY = 'graph_refresh_token';

  // --- Refresh token storage ---
  // Store refresh tokens in chrome.storage.session (not localStorage) so they
  // are not persisted to disk and are cleared when the browser session ends.

  static async _getRefreshToken() {
    try {
      const result = await chrome.storage.session.get(this.REFRESH_TOKEN_SESSION_KEY);
      return result[this.REFRESH_TOKEN_SESSION_KEY] || null;
    } catch {
      return null;
    }
  }

  static async _setRefreshToken(token) {
    try {
      await chrome.storage.session.set({ [this.REFRESH_TOKEN_SESSION_KEY]: token });
    } catch (e) {
      console.error(`${this.LOG_PREFIX} Failed to save refresh token:`, e);
    }
  }

  static async _clearRefreshToken() {
    try {
      await chrome.storage.session.remove(this.REFRESH_TOKEN_SESSION_KEY);
    } catch {
      // best-effort
    }
  }

  /**
   * Override cacheToken to store refresh tokens in chrome.storage.session
   * while keeping access tokens in localStorage for synchronous reads.
   */
  static cacheToken(data) {
    const { refreshToken, ...rest } = data;
    super.cacheToken(rest);
    if (refreshToken) {
      this._setRefreshToken(refreshToken);
    }
  }

  /** Override clearCache to also clear the session-stored refresh token. */
  static clearCache() {
    super.clearCache();
    this._clearRefreshToken();
  }

  /**
   * Acquire a fresh token. Tries silent refresh first, then interactive PKCE.
   * @returns {Promise<string>}
   */
  static async _acquireToken() {
    // Try silent refresh first if we have a refresh token
    const refreshToken = await this._getRefreshToken();
    if (refreshToken) {
      const refreshResult = await this.refreshAccessToken(refreshToken);
      if (refreshResult?.access_token) {
        const expiresOn = new Date(Date.now() + refreshResult.expires_in * 1000).toISOString();
        this.cacheToken({
          accessToken: refreshResult.access_token,
          refreshToken: refreshResult.refresh_token,
          expiresOn
        });
        return refreshResult.access_token;
      }
      // Refresh failed — clear stale data, fall through to interactive
      this.clearCache();
    }

    // Interactive auth via launchWebAuthFlow + PKCE
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const authUrl = this.buildAuthUrl(codeChallenge);
    const redirectUrl = await this.launchAuthFlow(authUrl);
    const authCode = this.extractAuthCode(redirectUrl);
    const tokenResult = await this.exchangeCodeForTokens(authCode, codeVerifier);

    const expiresOn = new Date(Date.now() + tokenResult.expires_in * 1000).toISOString();
    this.cacheToken({
      accessToken: tokenResult.access_token,
      refreshToken: tokenResult.refresh_token,
      expiresOn
    });
    return tokenResult.access_token;
  }

  // ---------------------------------------------------------------------------
  // Provider-specific OAuth2 helpers
  // ---------------------------------------------------------------------------

  static buildAuthUrl(codeChallenge) {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });
    return `${AUTH_ENDPOINT}?${params}`;
  }

  static async exchangeCodeForTokens(authCode, codeVerifier) {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
      scope: SCOPES
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || response.status}`);
    }

    return response.json();
  }

  static async refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES
    });

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
}

export { GraphAuthHelper };
