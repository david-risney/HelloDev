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
});

// Get access token via native messaging host
async function getNativeToken(hostName, resource) {
  return new Promise((resolve) => {
    try {
      console.log('[background] Connecting to native host:', hostName);
      const port = chrome.runtime.connectNative(hostName);

      port.onMessage.addListener((response) => {
        console.log('[background] Native host response received');
        port.disconnect();
        if (response.error) {
          console.log('[background] Native host error:', response.error, response.details || '');
          resolve({ error: response.error, details: response.details });
        } else if (response.accessToken) {
          console.log('[background] Got token, expiresOn:', response.expiresOn);
          resolve({ accessToken: response.accessToken, expiresOn: response.expiresOn });
        } else {
          console.log('[background] Invalid response from native host:', response);
          resolve({ error: 'Invalid response from native host' });
        }
      });

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('[background] Native host disconnected with error:', error.message);
          resolve({
            error: `Native host error: ${error.message}. Make sure the native host is installed.`
          });
        }
      });

      console.log('[background] Sending getToken request to native host');
      const message = { action: 'getToken' };
      if (resource) message.resource = resource;
      port.postMessage(message);
    } catch (error) {
      console.error('[background] Exception connecting to native host:', error);
      resolve({ error: error.message });
    }
  });
}
