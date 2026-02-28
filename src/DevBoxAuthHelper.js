/**
 * Microsoft Dev Box Authentication Helper
 * Reuses the ADO native messaging host with the Dev Center resource scope.
 *
 * The az CLI command executed by the native host becomes:
 *   az account get-access-token --resource https://devcenter.azure.com -o json
 */
import { AuthHelperBase } from './AuthHelperBase.js';

const DEVCENTER_RESOURCE = 'https://devcenter.azure.com';

class DevBoxAuthHelper extends AuthHelperBase {
  static TOKEN_CACHE_KEY = 'devbox_auth_token';
  static LOG_PREFIX = '[DevBoxAuthHelper]';

  /**
   * Acquire a fresh token via the ADO native host with the Dev Center resource.
   * The background script forwards the resource parameter to the native host,
   * which calls: az account get-access-token --resource https://devcenter.azure.com
   * @returns {Promise<string>}
   */
  static async _acquireToken() {
    const response = await this.sendMessage({
      type: 'ADO_GET_TOKEN',
      resource: DEVCENTER_RESOURCE
    });

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

export { DevBoxAuthHelper };
