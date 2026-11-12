export const DEVDASH_HOST = 'com.devdash.cli';
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const QUERY_COMMANDS = new Set(['hello', 'health', 'profiles', 'get', 'refresh-start', 'status']);

export function validateDevDashRequest(request) {
  if (!request || !QUERY_COMMANDS.has(request.command)) {
    throw new Error('Unsupported HelloDev DevDash command');
  }
  if (['get', 'refresh-start', 'status'].includes(request.command) &&
      (typeof request.profile !== 'string' || !NAME.test(request.profile))) {
    throw new Error('Select a DevDash profile (letters, numbers, dots, underscores or dashes)');
  }
  if (request.query !== undefined && (typeof request.query !== 'string' || !NAME.test(request.query) ||
      typeof request.profile !== 'string' || !NAME.test(request.profile))) {
    throw new Error('Select a valid named query, or leave it empty for a flat profile');
  }
}

export class DevDashClient {
  static request(request, { signal, timeout = 180_000 } = {}) {
    validateDevDashRequest(request);
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Request cancelled', 'AbortError'));
        return;
      }
      let port;
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        port?.disconnect();
        if (error) reject(error);
        else resolve(value);
      };
      const abort = () => finish(new DOMException('Request cancelled', 'AbortError'));
      const timer = setTimeout(() => finish(new Error(
        'DevDash timed out. Check devdash logs tail --errors; retry to read the shared cache.'
      )), timeout);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        port = chrome.runtime.connectNative(DEVDASH_HOST);
        port.onMessage.addListener(response => {
          if (response?.error) {
            const error = new Error(response.error.message || 'DevDash request failed');
            error.code = response.error.code;
            error.diagnosticId = response.error.diagnosticId;
            finish(error);
          } else if (!response || typeof response !== 'object') {
            finish(new Error('Invalid DevDash response'));
          } else {
            finish(null, response);
          }
        });
        port.onDisconnect.addListener(() => {
          const error = chrome.runtime.lastError;
          finish(new Error(error?.message || 'DevDash disconnected without a response'));
        });
        port.postMessage(request);
      } catch (error) {
        finish(error);
      }
    });
  }
}
