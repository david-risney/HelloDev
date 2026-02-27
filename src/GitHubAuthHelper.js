/**
 * GitHub Authentication Helper
 * Uses native messaging to gh cli via the background script.
 */
import { AuthHelperBase } from './AuthHelperBase.js';

class GitHubAuthHelper extends AuthHelperBase {
  static TOKEN_CACHE_KEY = 'github_auth_token';
  static LOG_PREFIX = '[GitHubAuthHelper]';

  /**
   * Acquire a fresh token via the background script / native host.
   * Called by AuthHelperBase.getToken() when no valid cached token exists.
   * @returns {Promise<string>}
   */
  static async _acquireToken() {
    const response = await this.sendMessage({ type: 'GITHUB_GET_TOKEN' });

    if (response.accessToken && response.expiresOn) {
      this.cacheToken({
        accessToken: response.accessToken,
        expiresOn: response.expiresOn
      });
      return response.accessToken;
    }

    throw new Error(
      'No access token received. Make sure gh cli is installed and you are logged in (gh auth login).'
    );
  }
}

export { GitHubAuthHelper };
