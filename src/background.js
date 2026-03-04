// Open HelloDev page in a new tab when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'hellodev.html' });
});

// ============================================================================
// Native Messaging for Azure DevOps Token (via az cli)
// ============================================================================

const ADO_NATIVE_HOST_NAME = 'com.hellodev.ado';

// ============================================================================
// Native Messaging for GitHub Token (via gh cli)
// ============================================================================

const GITHUB_NATIVE_HOST_NAME = 'com.hellodev.github';

// Handle messages from extension pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[background] Received message:', request.type);
  
  if (request.type === 'ADO_GET_TOKEN') {
    console.log('[background] Getting ADO token from native host...');
    getNativeToken(ADO_NATIVE_HOST_NAME, request.resource).then(result => {
      console.log('[background] ADO native host result:',
        result.error ? `error: ${result.error} ${result.details || ''}` : 'success');
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }

  if (request.type === 'GITHUB_GET_TOKEN') {
    console.log('[background] Getting GitHub token from native host...');
    getNativeToken(GITHUB_NATIVE_HOST_NAME).then(result => {
      console.log('[background] GitHub native host result:',
        result.error ? `error: ${result.error} ${result.details || ''}` : 'success');
      sendResponse(result);
    });
    return true;
  }

  if (request.type === 'PROBE_NATIVE_HOST') {
    console.log('[background] Probing native host availability...');
    probeNativeHost().then(result => {
      console.log('[background] Probe result:', result);
      sendResponse(result);
    });
    return true;
  }
});

// Timeout for native host responses (ms)
const NATIVE_HOST_TIMEOUT_MS = 30_000;

// Get access token via native messaging host
async function getNativeToken(hostName, resource) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let settled = false;

    function settle(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const elapsed = Date.now() - startTime;
      console.log(`[background] getNativeToken settled in ${elapsed}ms`);
      resolve(result);
    }

    // Timeout to prevent hanging forever if the native host never responds
    const timer = setTimeout(() => {
      console.error(`[background] Native host ${hostName} timed out after ${NATIVE_HOST_TIMEOUT_MS}ms`);
      try { port.disconnect(); } catch (_) { /* ignore */ }
      settle({
        error: `Native host timed out after ${NATIVE_HOST_TIMEOUT_MS / 1000}s. ` +
               'The CLI may be unresponsive — check that it works from a terminal.'
      });
    }, NATIVE_HOST_TIMEOUT_MS);

    let port;
    try {
      console.log('[background] Connecting to native host:', hostName);
      port = chrome.runtime.connectNative(hostName);

      port.onMessage.addListener((response) => {
        console.log('[background] Native host response received');
        port.disconnect();
        if (response.error) {
          console.log('[background] Native host error:', response.error, response.details || '');
          settle({ error: response.error, details: response.details });
        } else if (response.accessToken) {
          console.log('[background] Got token, expiresOn:', response.expiresOn);
          settle({ accessToken: response.accessToken, expiresOn: response.expiresOn });
        } else {
          console.log('[background] Invalid response from native host:', JSON.stringify(response));
          settle({ error: 'Invalid response from native host' });
        }
      });

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('[background] Native host disconnected with error:', error.message);
          settle({
            error: `Native host error: ${error.message}. Make sure the native host is installed.`
          });
        } else {
          console.log('[background] Native host disconnected normally');
        }
      });

      console.log('[background] Sending getToken request to native host');
      const message = { action: 'getToken' };
      if (resource) message.resource = resource;
      port.postMessage(message);
    } catch (error) {
      console.error('[background] Exception connecting to native host:', error);
      settle({ error: error.message });
    }
  });
}

// Lightweight probe: connect and send a ping to check if host is registered.
// The host will respond with an error for the unknown action, which still
// proves it is installed and reachable.
const PROBE_TIMEOUT_MS = 3000;

async function probeNativeHost() {
  console.log('[background] probeNativeHost: starting probe...');
  return new Promise((resolve) => {
    let settled = false;

    function settle(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.log('[background] probeNativeHost: settled with', JSON.stringify(result));
      resolve(result);
    }

    const timer = setTimeout(() => {
      console.log('[background] probeNativeHost: timed out after', PROBE_TIMEOUT_MS, 'ms');
      try { port.disconnect(); } catch (_) { /* ignore */ }
      settle({ installed: false });
    }, PROBE_TIMEOUT_MS);

    let port;
    try {
      console.log('[background] probeNativeHost: connecting to', ADO_NATIVE_HOST_NAME);
      port = chrome.runtime.connectNative(ADO_NATIVE_HOST_NAME);

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        console.log('[background] probeNativeHost: onDisconnect, error:', error?.message || 'none');
        if (error) {
          settle({ installed: false });
        } else {
          settle({ installed: true });
        }
      });

      port.onMessage.addListener((msg) => {
        console.log('[background] probeNativeHost: onMessage received:', JSON.stringify(msg));
        try { port.disconnect(); } catch (_) { /* ignore */ }
        settle({ installed: true });
      });

      console.log('[background] probeNativeHost: sending ping message');
      port.postMessage({ action: 'ping' });

    } catch (error) {
      console.error('[background] probeNativeHost: exception:', error.message);
      settle({ installed: false });
    }
  });
}
