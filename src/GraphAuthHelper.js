/**
 * Microsoft Graph Authentication Helper
 * Manages token acquisition and caching for Graph API widgets (Calendar, etc.)
 *
 * Uses OAuth2 Authorization Code flow with PKCE via chrome.identity.launchWebAuthFlow.
 * Requires a custom Azure AD (Entra ID) app registration with:
 *   - Redirect URI: chrome.identity.getRedirectURL()  (platform: SPA)
 *   - Delegated permission: Microsoft Graph > Calendars.ReadBasic
 */

import { PromiseCoalescer } from './PromiseCoalescer.js';

// ---------------------------------------------------------------------------
// Configuration — fill in CLIENT_ID from your Azure AD app registration
// ---------------------------------------------------------------------------
const CLIENT_ID = '8d5d4444-9cde-4d85-be59-b05e129d9a4b';
const TENANT_ID = 'common';
const AUTH_ENDPOINT = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const SCOPES = 'Calendars.ReadBasic offline_access';
const REDIRECT_URI = chrome.identity.getRedirectURL();

const TOKEN_CACHE_KEY = 'graph_auth_token';
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

const tokenFetchCoalescer = new PromiseCoalescer();

class GraphAuthHelper {
  // ---------------------------------------------------------------------------
  // Cache
  // ---------------------------------------------------------------------------

  static getCachedToken() {
    try {
      const cached = localStorage.getItem(TOKEN_CACHE_KEY);
      if (!cached) return null;
      const data = JSON.parse(cached);
      if (!data.accessToken || !data.expiresOn) return null;
      return data;
    } catch (e) {
      console.error('[GraphAuthHelper] Error reading cache:', e);
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

  static cacheToken(accessToken, refreshToken, expiresOn) {
    try {
      localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({ accessToken, refreshToken, expiresOn }));
    } catch (e) {
      console.error('[GraphAuthHelper] Cache save error:', e);
    }
  }

  static clearCache() {
    try {
      localStorage.removeItem(TOKEN_CACHE_KEY);
    } catch (e) {
      console.error('[GraphAuthHelper] Cache clear error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  static async getToken() {
    const cachedToken = this.getValidToken();
    if (cachedToken) return cachedToken;

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

  static handleAuthError(errorMessage) {
    const authKeywords = ['login', '401', 'authentication', 'token', 'unauthorized'];
    const isAuthError = authKeywords.some(k => errorMessage.toLowerCase().includes(k));
    if (isAuthError) {
      this.clearCache();
    }
    return isAuthError;
  }

  // ---------------------------------------------------------------------------
  // Token acquisition
  // ---------------------------------------------------------------------------

  static async acquireToken() {
    // Try silent refresh first if we have a refresh token
    const cached = this.getCachedToken();
    if (cached?.refreshToken) {
      const refreshResult = await this.refreshAccessToken(cached.refreshToken);
      if (refreshResult?.access_token) {
        const expiresOn = new Date(Date.now() + refreshResult.expires_in * 1000).toISOString();
        this.cacheToken(refreshResult.access_token, refreshResult.refresh_token, expiresOn);
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
    this.cacheToken(tokenResult.access_token, tokenResult.refresh_token, expiresOn);
    return tokenResult.access_token;
  }

  // ---------------------------------------------------------------------------
  // OAuth2 helpers
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

  // ---------------------------------------------------------------------------
  // PKCE
  // ---------------------------------------------------------------------------

  static generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  static async generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  static base64UrlEncode(buffer) {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

export { GraphAuthHelper };
