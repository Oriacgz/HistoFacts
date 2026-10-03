import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from './relativeTime';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for missing or null input', () => {
    expect(formatRelativeTime(null)).toBe('');
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('returns "now" for timestamps under 60 seconds ago', () => {
    const now = new Date('2026-09-23T12:00:00Z').getTime();
    vi.setSystemTime(now);
    const thirtySecsAgo = new Date(now - 30 * 1000).toISOString();
    expect(formatRelativeTime(thirtySecsAgo)).toBe('now');
  });

  it('formats minutes, hours, and days correctly', () => {
    const now = new Date('2026-09-23T12:00:00Z').getTime();
    vi.setSystemTime(now);

    const fiveMinsAgo = new Date(now - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinsAgo)).toBe('5m');

    const threeHoursAgo = new Date(now - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h');

    const twoDaysAgo = new Date(now - 2 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d');
  });
});
