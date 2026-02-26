import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeFormatter } from '../../src/TimeFormatter.js';

describe('TimeFormatter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelative', () => {
    it('returns empty string for falsy input', () => {
      expect(TimeFormatter.formatRelative(null)).toBe('');
      expect(TimeFormatter.formatRelative(undefined)).toBe('');
      expect(TimeFormatter.formatRelative(0)).toBe('');
      expect(TimeFormatter.formatRelative('')).toBe('');
    });

    it('returns empty string for invalid date', () => {
      expect(TimeFormatter.formatRelative('not-a-date')).toBe('');
      expect(TimeFormatter.formatRelative(NaN)).toBe('');
    });

    it('returns "just now" for timestamps less than 60 seconds ago', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative(now)).toBe('just now');
      expect(TimeFormatter.formatRelative(now.getTime() - 30_000)).toBe('just now');
      expect(TimeFormatter.formatRelative(now.getTime() - 59_000)).toBe('just now');
    });

    it('returns "just now" for future dates', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative(now.getTime() + 60_000)).toBe('just now');
    });

    it('formats minutes correctly', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative(now.getTime() - 60_000)).toBe('1 minute ago');
      expect(TimeFormatter.formatRelative(now.getTime() - 5 * 60_000)).toBe('5 minutes ago');
      expect(TimeFormatter.formatRelative(now.getTime() - 59 * 60_000)).toBe('59 minutes ago');
    });

    it('formats hours correctly', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative(now.getTime() - 60 * 60_000)).toBe('1 hour ago');
      expect(TimeFormatter.formatRelative(now.getTime() - 3 * 60 * 60_000)).toBe('3 hours ago');
      expect(TimeFormatter.formatRelative(now.getTime() - 23 * 60 * 60_000)).toBe('23 hours ago');
    });

    it('formats days correctly', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative(now.getTime() - 24 * 60 * 60_000)).toBe('1 day ago');
      expect(TimeFormatter.formatRelative(now.getTime() - 7 * 24 * 60 * 60_000)).toBe('7 days ago');
      expect(TimeFormatter.formatRelative(now.getTime() - 29 * 24 * 60 * 60_000)).toBe('29 days ago');
    });

    it('formats months correctly', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative(now.getTime() - 30 * 24 * 60 * 60_000)).toBe('1 month ago');
      expect(TimeFormatter.formatRelative(now.getTime() - 90 * 24 * 60 * 60_000)).toBe('3 months ago');
    });

    it('formats years correctly', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative(now.getTime() - 365 * 24 * 60 * 60_000)).toBe('1 year ago');
      expect(TimeFormatter.formatRelative(now.getTime() - 2 * 365 * 24 * 60 * 60_000)).toBe('2 years ago');
    });

    it('accepts Date objects', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
      expect(TimeFormatter.formatRelative(fiveMinAgo)).toBe('5 minutes ago');
    });

    it('accepts date strings', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative('2026-02-26T11:55:00Z')).toBe('5 minutes ago');
    });

    it('accepts numeric timestamps', () => {
      const now = new Date('2026-02-26T12:00:00Z');
      vi.setSystemTime(now);

      expect(TimeFormatter.formatRelative(now.getTime() - 120_000)).toBe('2 minutes ago');
    });
  });

  describe('formatAbsoluteShort', () => {
    it('returns empty string for falsy input', () => {
      expect(TimeFormatter.formatAbsoluteShort(null)).toBe('');
      expect(TimeFormatter.formatAbsoluteShort(undefined)).toBe('');
      expect(TimeFormatter.formatAbsoluteShort(0)).toBe('');
      expect(TimeFormatter.formatAbsoluteShort('')).toBe('');
    });

    it('returns empty string for invalid date', () => {
      expect(TimeFormatter.formatAbsoluteShort('not-a-date')).toBe('');
    });

    it('formats AM times correctly', () => {
      const date = new Date(2026, 0, 15, 9, 5); // Jan 15, 2026 9:05 AM
      const result = TimeFormatter.formatAbsoluteShort(date);
      expect(result).toBe('1-15-2026 9:05am');
    });

    it('formats PM times correctly', () => {
      const date = new Date(2026, 5, 3, 15, 42); // Jun 3, 2026 3:42 PM
      const result = TimeFormatter.formatAbsoluteShort(date);
      expect(result).toBe('6-03-2026 3:42pm');
    });

    it('formats noon as 12pm', () => {
      const date = new Date(2026, 11, 25, 12, 0); // Dec 25, 2026 12:00 PM
      const result = TimeFormatter.formatAbsoluteShort(date);
      expect(result).toBe('12-25-2026 12:00pm');
    });

    it('formats midnight as 12am', () => {
      const date = new Date(2026, 0, 1, 0, 0); // Jan 1, 2026 12:00 AM
      const result = TimeFormatter.formatAbsoluteShort(date);
      expect(result).toBe('1-01-2026 12:00am');
    });

    it('accepts numeric timestamps', () => {
      const date = new Date(2026, 2, 10, 14, 30); // Mar 10, 2026 2:30 PM
      const result = TimeFormatter.formatAbsoluteShort(date.getTime());
      expect(result).toBe('3-10-2026 2:30pm');
    });

    it('accepts date strings', () => {
      // Use a specific timezone-aware approach
      const date = new Date(2026, 6, 4, 8, 15); // Jul 4, 2026 8:15 AM local
      const result = TimeFormatter.formatAbsoluteShort(date.toISOString());
      // The exact output depends on local timezone, but it should be non-empty
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{1,2}-\d{2}-\d{4} \d{1,2}:\d{2}(am|pm)$/);
    });
  });
});
