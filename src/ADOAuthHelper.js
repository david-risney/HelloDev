/**
 * Azure DevOps Authentication Helper
 * Uses native messaging to az cli via the background script.
 */
import { AuthHelperBase } from './AuthHelperBase.js';

class ADOAuthHelper extends AuthHelperBase {
  static TOKEN_CACHE_KEY = 'ado_auth_token';
  static LOG_PREFIX = '[ADOAuthHelper]';

  /**
   * Acquire a fresh token via the background script / native host.
   * Called by AuthHelperBase.getToken() when no valid cached token exists.
   * @returns {Promise<string>}
   */
  static async _acquireToken() {
    const response = await this.sendMessage({ type: 'ADO_GET_TOKEN' });

    if (response.accessToken && response.expiresOn) {
      this.cacheToken({
        accessToken: response.accessToken,
        expiresOn: response.expiresOn
      });
      return response.accessToken;
    }

    throw new Error(
      'No access token received. Make sure az cli is installed and you are logged in (az login).'
    );
  }

  /**
   * Send a message to the background script.
   * @private
   */
  static sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        reject(new Error('Extension API not available'));
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Extension communication error. Try reloading the page.'));
        } else if (response?.error) {
          const err = new Error(response.error);
          err.details = response.details || null;
          reject(err);
        } else if (!response) {
          reject(new Error('No response from background script'));
        } else {
          resolve(response);
        }
      });
    });
  }
}

export { ADOAuthHelper };
