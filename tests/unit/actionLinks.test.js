import { describe, it, expect } from 'vitest';
import { parseActionUrl, findPackByName } from '../../src/actionLinks.js';

describe('actionLinks', () => {
  describe('parseActionUrl', () => {
    it('returns null for empty or missing hash', () => {
      expect(parseActionUrl('')).toBeNull();
      expect(parseActionUrl(null)).toBeNull();
      expect(parseActionUrl(undefined)).toBeNull();
    });

    it('returns null when hash has no action param', () => {
      expect(parseActionUrl('#foo=bar')).toBeNull();
    });

    it('parses add action with name', () => {
      const result = parseActionUrl('#action=add&name=ado+dev');
      expect(result).not.toBeNull();
      expect(result.action).toBe('add');
      expect(result.params.get('name')).toBe('ado dev');
    });

    it('parses add action with encoded name', () => {
      const result = parseActionUrl('#action=add&name=ado+bugs');
      expect(result.action).toBe('add');
      expect(result.params.get('name')).toBe('ado bugs');
    });

    it('parses appearance action', () => {
      const result = parseActionUrl('#action=appearance');
      expect(result.action).toBe('appearance');
    });

    it('parses configure action with id', () => {
      const result = parseActionUrl('#action=configure&id=widget-default-3');
      expect(result).not.toBeNull();
      expect(result.action).toBe('configure');
      expect(result.params.get('id')).toBe('widget-default-3');
    });

    it('parses edit action', () => {
      const result = parseActionUrl('#action=edit');
      expect(result).not.toBeNull();
      expect(result.action).toBe('edit');
    });

    it('preserves extra params', () => {
      const result = parseActionUrl('#action=add&name=test&extra=1');
      expect(result.params.get('extra')).toBe('1');
    });
  });

  describe('findPackByName', () => {
    it('returns null for empty or missing name', () => {
      expect(findPackByName('')).toBeNull();
      expect(findPackByName(null)).toBeNull();
      expect(findPackByName(undefined)).toBeNull();
    });

    it('finds pack by exact name (case-insensitive)', () => {
      const pack = findPackByName('ado dev');
      expect(pack).not.toBeNull();
      expect(pack.id).toBe('ado-dev');
    });

    it('finds pack with different casing', () => {
      const pack = findPackByName('ADO DEV');
      expect(pack).not.toBeNull();
      expect(pack.id).toBe('ado-dev');
    });

    it('finds GitHub Dev pack', () => {
      const pack = findPackByName('GitHub Dev');
      expect(pack).not.toBeNull();
      expect(pack.id).toBe('github-dev');
    });

    it('returns null for partial match', () => {
      expect(findPackByName('ado')).toBeNull();
    });

    it('returns null for non-existent pack', () => {
      expect(findPackByName('nonexistent')).toBeNull();
    });
  });
});
