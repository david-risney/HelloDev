/**
 * Azure DevOps Authentication Helper
 * Manages token acquisition and caching for ADO widgets
 * 
 * Uses localStorage for synchronous cache access, with background script
 * for native messaging to az cli when token refresh is needed.
 */

const TOKEN_CACHE_KEY = 'ado_auth_token';

// Buffer time before the expiresOn value to ensure we don't expire mid 
// operation. 1 minute before actual expiration
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

class ADOAuthHelper {
  /**
   * Get the cached token synchronously (may be null or expired)
   * @returns {{ accessToken: string, expiresOn: string } | null}
   */
  static getCachedToken() {
    try {
      const cached = localStorage.getItem(TOKEN_CACHE_KEY);
      if (!cached) {
        console.log('[ADOAuthHelper] No cached token in localStorage');
        return null;
      }
      
      const data = JSON.parse(cached);
      if (!data.accessToken || !data.expiresOn) {
        console.log('[ADOAuthHelper] Cached token missing accessToken or expiresOn');
        return null;
      }
      
      console.log('[ADOAuthHelper] Found cached token, expiresOn:', data.expiresOn);
      return data;
    } catch (e) {
      console.error('[ADOAuthHelper] Error reading cache:', e);
      return null;
    }
  }
  
  /**
   * Check if the cached token is still valid
   * @returns {boolean}
   */
  static isTokenValid() {
    const cached = this.getCachedToken();
    if (!cached) {
      console.log('[ADOAuthHelper] isTokenValid: no cached token');
      return false;
    }
    
    const expiryTime = new Date(cached.expiresOn).getTime();
    const now = Date.now();
    const timeRemaining = expiryTime - now;
    const isValid = timeRemaining > TOKEN_EXPIRY_BUFFER_MS;
    
    console.log('[ADOAuthHelper] isTokenValid:', isValid, 
      '| expires in:', Math.round(timeRemaining / 1000), 'seconds',
      '| buffer:', TOKEN_EXPIRY_BUFFER_MS / 1000, 'seconds');
    
    return isValid;
  }
  
  /**
   * Get the access token synchronously if valid, null otherwise
   * @returns {string | null}
   */
  static getValidToken() {
    if (!this.isTokenValid()) return null;
    return this.getCachedToken()?.accessToken || null;
  }
  
  /**
   * Save token to localStorage cache
   * @param {string} accessToken 
   * @param {string} expiresOn 
   */
  static cacheToken(accessToken, expiresOn) {
    try {
      localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({
        accessToken,
        expiresOn
      }));
    } catch (e) {
      console.error('[ADOAuthHelper] Cache save error:', e);
    }
  }
  
  /**
   * Clear the token cache
   */
  static clearCache() {
    try {
      localStorage.removeItem(TOKEN_CACHE_KEY);
    } catch (e) {
      console.error('[ADOAuthHelper] Cache clear error:', e);
    }
  }
  
  /**
   * Get a valid access token, refreshing if needed (async)
   * Uses cached token if valid, otherwise fetches new token via background script
   * @returns {Promise<string>} The access token
   * @throws {Error} If token cannot be obtained
   */
  static async getToken() {
    console.log('[ADOAuthHelper] getToken() called');
    
    // Try cached token first (synchronous)
    const cachedToken = this.getValidToken();
    if (cachedToken) {
      console.log('[ADOAuthHelper] Using valid cached token');
      return cachedToken;
    }
    
    console.log('[ADOAuthHelper] No valid cached token, requesting from background...');
    
    // Need to fetch new token via background script
    try {
      const response = await this.sendMessage({ type: 'ADO_GET_TOKEN' });
      console.log('[ADOAuthHelper] Background response:', 
        response.accessToken ? 'got token' : 'no token',
        '| expiresOn:', response.expiresOn);
      
      if (response.accessToken && response.expiresOn) {
        // Cache locally for synchronous access
        this.cacheToken(response.accessToken, response.expiresOn);
        console.log('[ADOAuthHelper] Token cached successfully');
        return response.accessToken;
      }
    } catch (e) {
      console.error('[ADOAuthHelper] Error from background:', e.message);
      throw e;
    }
    
    throw new Error('No access token received. Make sure az cli is installed and you are logged in (az login).');
  }
  
  /**
   * Force refresh the token (clears cache and fetches new)
   * @returns {Promise<string>} The new access token
   * @throws {Error} If token cannot be obtained
   */
  static async refreshToken() {
    this.clearCache();
    await this.sendMessage({ type: 'ADO_CLEAR_TOKEN_CACHE' }).catch(() => {});
    
    const response = await this.sendMessage({ type: 'ADO_GET_TOKEN' });
    
    if (response.accessToken && response.expiresOn) {
      this.cacheToken(response.accessToken, response.expiresOn);
      return response.accessToken;
    }
    
    throw new Error('No access token received. Make sure az cli is installed and you are logged in (az login).');
  }
  
  /**
   * Handle auth errors by clearing the cache
   * @param {string} errorMessage 
   * @returns {boolean} True if it was an auth error
   */
  static handleAuthError(errorMessage) {
    const authKeywords = ['login', '401', 'authentication', 'token', 'unauthorized'];
    const isAuthError = authKeywords.some(k => errorMessage.toLowerCase().includes(k));
    
    if (isAuthError) {
      this.clearCache();
      this.sendMessage({ type: 'ADO_CLEAR_TOKEN_CACHE' }).catch(() => {});
    }
    
    return isAuthError;
  }
  
  /**
   * Send a message to the background script
   * @private
   */
  static sendMessage(message) {
    console.log('[ADOAuthHelper] Sending message to background:', message.type);
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        console.error('[ADOAuthHelper] Chrome API not available');
        reject(new Error('Extension API not available'));
        return;
      }
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[ADOAuthHelper] Chrome runtime error:', chrome.runtime.lastError.message);
          reject(new Error('Extension communication error. Try reloading the page.'));
        } else if (response?.error) {
          console.error('[ADOAuthHelper] Background returned error:', response.error);
          reject(new Error(response.error));
        } else if (!response) {
          console.error('[ADOAuthHelper] No response from background');
          reject(new Error('No response from background script'));
        } else {
          console.log('[ADOAuthHelper] Got response from background');
          resolve(response);
        }
      });
    });
  }
}

export { ADOAuthHelper };
