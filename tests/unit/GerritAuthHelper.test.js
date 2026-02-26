import { describe, it, expect } from 'vitest';
import { GerritAuthHelper } from '../../src/GerritAuthHelper.js';

describe('GerritAuthHelper', () => {
  describe('getAuthHeader', () => {
    it('returns Basic auth header for gitcookies mode with valid token', async () => {
      const result = await GerritAuthHelper.getAuthHeader('gitcookies', {
        token: 'git-user@chromium.org=secret123'
      });
      // btoa('git-user@chromium.org:secret123')
      const expected = `Basic ${btoa('git-user@chromium.org:secret123')}`;
      expect(result).toBe(expected);
    });

    it('splits on first = only (password may contain =)', async () => {
      const result = await GerritAuthHelper.getAuthHeader('gitcookies', {
        token: 'user=pass=with=equals'
      });
      const expected = `Basic ${btoa('user:pass=with=equals')}`;
      expect(result).toBe(expected);
    });

    it('returns null for gitcookies mode without token', async () => {
      expect(await GerritAuthHelper.getAuthHeader('gitcookies', {})).toBeNull();
      expect(await GerritAuthHelper.getAuthHeader('gitcookies', undefined)).toBeNull();
    });

    it('returns null for gitcookies with token missing =', async () => {
      const result = await GerritAuthHelper.getAuthHeader('gitcookies', {
        token: 'notokenformat'
      });
      expect(result).toBeNull();
    });

    it('returns null for anonymous mode', async () => {
      expect(await GerritAuthHelper.getAuthHeader('anonymous')).toBeNull();
    });

    it('returns null for anonymous mode even with credentials', async () => {
      const result = await GerritAuthHelper.getAuthHeader('anonymous', {
        token: 'user=pass'
      });
      expect(result).toBeNull();
    });
  });

  describe('handleAuthError', () => {
    it('returns true for messages containing auth keywords', () => {
      expect(GerritAuthHelper.handleAuthError('Got 401 from server')).toBe(true);
      expect(GerritAuthHelper.handleAuthError('Authentication required')).toBe(true);
      expect(GerritAuthHelper.handleAuthError('Invalid token')).toBe(true);
      expect(GerritAuthHelper.handleAuthError('Unauthorized access')).toBe(true);
      expect(GerritAuthHelper.handleAuthError('Please login first')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(GerritAuthHelper.handleAuthError('UNAUTHORIZED')).toBe(true);
      expect(GerritAuthHelper.handleAuthError('Token expired')).toBe(true);
    });

    it('returns false for non-auth errors', () => {
      expect(GerritAuthHelper.handleAuthError('Network timeout')).toBe(false);
      expect(GerritAuthHelper.handleAuthError('Server error 500')).toBe(false);
      expect(GerritAuthHelper.handleAuthError('Not found')).toBe(false);
    });
  });
});
