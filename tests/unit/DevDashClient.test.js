import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DevDashClient, DEVDASH_HOST } from '../../src/DevDashClient.js';

let port, receive, disconnect;
beforeEach(() => {
  vi.useFakeTimers();
  port = {
    postMessage: vi.fn(), disconnect: vi.fn(),
    onMessage: { addListener: fn => { receive = fn; } },
    onDisconnect: { addListener: fn => { disconnect = fn; } }
  };
  chrome.runtime.connectNative.mockReturnValue(port);
  delete chrome.runtime.lastError;
});
afterEach(() => vi.useRealTimers());

describe('DevDash native transport', () => {
  it('uses the DevDash host without acquiring browser-side credentials', async () => {
    const request = { command: 'get', profile: 'work', query: 'bugs', cacheMode: 'adaptive' };
    const result = DevDashClient.request(request);
    expect(chrome.runtime.connectNative).toHaveBeenCalledWith(DEVDASH_HOST);
    expect(port.postMessage).toHaveBeenCalledWith(request);
    receive({ schemaVersion: 1, items: [] });
    await expect(result).resolves.toMatchObject({ items: [] });
    expect(port.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves explicit error codes and diagnostic IDs', async () => {
    const result = DevDashClient.request({ command: 'get', profile: 'work' });
    receive({ error: { code: 'CACHEMISS', message: 'No snapshot', diagnosticId: 'request-1' } });
    await expect(result).rejects.toMatchObject({ code: 'CACHEMISS', diagnosticId: 'request-1' });
  });

  it('reports an absent native host rather than returning an empty list', async () => {
    const result = DevDashClient.request({ command: 'hello' });
    chrome.runtime.lastError = { message: 'Specified native messaging host not found.' };
    disconnect();
    await expect(result).rejects.toThrow('host not found');
  });

  it('bounds unresponsive requests and disconnects their port', async () => {
    const result = DevDashClient.request({ command: 'hello' }, { timeout: 100 });
    const rejection = expect(result).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(port.disconnect).toHaveBeenCalledOnce();
  });

  it('cancels work on widget removal', async () => {
    const controller = new AbortController();
    const result = DevDashClient.request({ command: 'hello' }, { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(port.disconnect).toHaveBeenCalledOnce();
  });

  it.each([
    { command: 'profile-set', profile: 'work' },
    { command: 'get', profile: '../other' },
    { command: 'get', profile: 'work', query: 'bad query' }
  ])('rejects invalid or write requests before connecting: %j', request => {
    expect(() => DevDashClient.request(request)).toThrow();
    expect(chrome.runtime.connectNative).not.toHaveBeenCalled();
  });
});
