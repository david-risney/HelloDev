import { DevDashClient } from './DevDashClient.js';

chrome.action.onClicked.addListener(async () => {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('hellodev.html') });
  } catch (error) {
    console.error('Could not open HelloDev:', error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  if (request?.type !== 'PROBE_NATIVE_HOST') return;
  void (async () => {
    try {
      const hello = await DevDashClient.request({ command: 'hello' }, { timeout: 10_000 });
      sendResponse({ installed: hello.schemaVersion === 1 });
    } catch (error) {
      // Missing optional local software is setup state, not a page/runtime fault.
      console.info('DevDash connection check:', error.message);
      sendResponse({ installed: false, error: error.message });
    }
  })();
  return true;
});
