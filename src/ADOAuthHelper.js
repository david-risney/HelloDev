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
}

export { ADOAuthHelper };
