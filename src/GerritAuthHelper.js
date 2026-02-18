/**
 * Gerrit / Chromium Code Review Authentication Helper
 *
 * Supports two authentication modes:
 *   1. "gitcookies" – HTTP Basic auth using token from chromium.googlesource.com/new-password
 *   2. "anonymous"  – No authentication; can only read public CLs.
 */

class GerritAuthHelper {
  /**
   * Build the Authorization header value for a given auth mode.
   * @param {"gitcookies"|"anonymous"} mode
   * @param {{ token?: string }} [credentials]
   * @returns {Promise<string|null>} The header value, or null for anonymous.
   */
  static async getAuthHeader(mode, credentials) {
    if (mode === 'gitcookies' && credentials?.token) {
      // Token format from .gitcookies: "git-user@domain=password"
      // Split on first '=' to get username and password for HTTP Basic auth.
      const eqIndex = credentials.token.indexOf('=');
      if (eqIndex > 0) {
        const username = credentials.token.substring(0, eqIndex);
        const password = credentials.token.substring(eqIndex + 1);
        return `Basic ${btoa(`${username}:${password}`)}`;
      }
    }
    return null;   // anonymous
  }

  static handleAuthError(errorMessage) {
    const authKeywords = ['login', '401', 'authentication', 'token', 'unauthorized'];
    return authKeywords.some(k => errorMessage.toLowerCase().includes(k));
  }
}

export { GerritAuthHelper };
