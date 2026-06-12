import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { todayStrInTz, startOfDayInTz, endOfDayInTz } from '../routes/reports.js';

describe('report timezone helpers', () => {
  describe('todayStrInTz', () => {
    test('returns correct date for Asia/Shanghai when server is UTC', () => {
      // Mock "now" to 2026-06-13 02:00 Asia/Shanghai = 2026-06-12 18:00 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-12T18:00:00Z'));

      try {
        expect(todayStrInTz('Asia/Shanghai')).toBe('2026-06-13');
        // UTC date should still be June 12
        expect(new Date().toISOString().slice(0, 10)).toBe('2026-06-12');
      } finally {
        vi.useRealTimers();
      }
    });

    test('returns correct date for UTC timezone', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-12T18:00:00Z'));

      try {
        expect(todayStrInTz('UTC')).toBe('2026-06-12');
      } finally {
        vi.useRealTimers();
      }
    });

    test('handles midnight boundary in target timezone', () => {
      // 2026-06-13 00:30 Asia/Shanghai = 2026-06-12 16:30 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-12T16:30:00Z'));

      try {
        expect(todayStrInTz('Asia/Shanghai')).toBe('2026-06-13');
      } finally {
        vi.useRealTimers();
      }
    });

    test('handles just before midnight in target timezone', () => {
      // 2026-06-12 23:59 Asia/Shanghai = 2026-06-12 15:59 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-12T15:59:00Z'));

      try {
        expect(todayStrInTz('Asia/Shanghai')).toBe('2026-06-12');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('startOfDayInTz', () => {
    test('returns UTC time corresponding to midnight in Asia/Shanghai', () => {
      // Midnight 2026-06-13 in Asia/Shanghai = 2026-06-12 16:00 UTC
      const result = startOfDayInTz('2026-06-13', 'Asia/Shanghai');
      expect(result.toISOString()).toBe('2026-06-12T16:00:00.000Z');
    });

    test('returns UTC time corresponding to midnight in UTC', () => {
      const result = startOfDayInTz('2026-06-13', 'UTC');
      expect(result.toISOString()).toBe('2026-06-13T00:00:00.000Z');
    });

    test('handles negative UTC offset (e.g., America/New_York)', () => {
      // Midnight 2026-06-13 in EDT (UTC-4) = 2026-06-13 04:00 UTC
      const result = startOfDayInTz('2026-06-13', 'America/New_York');
      expect(result.toISOString()).toBe('2026-06-13T04:00:00.000Z');
    });
  });

  describe('endOfDayInTz', () => {
    test('returns 23:59:59.999 in target timezone as UTC', () => {
      // End of 2026-06-13 in Asia/Shanghai = 2026-06-13 15:59:59.999 UTC
      const result = endOfDayInTz('2026-06-13', 'Asia/Shanghai');
      expect(result.toISOString()).toBe('2026-06-13T15:59:59.999Z');
    });

    test('endOfDay is exactly 1ms less than next day start', () => {
      const start = startOfDayInTz('2026-06-14', 'Asia/Shanghai');
      const end = endOfDayInTz('2026-06-13', 'Asia/Shanghai');
      expect(start.getTime() - end.getTime()).toBe(1);
    });
  });

  describe('getDateRange (via module)', () => {
    const origEnv = process.env.REPORT_TIMEZONE;

    beforeEach(() => {
      process.env.REPORT_TIMEZONE = 'Asia/Shanghai';
    });

    afterEach(() => {
      if (origEnv === undefined) {
        delete process.env.REPORT_TIMEZONE;
      } else {
        process.env.REPORT_TIMEZONE = origEnv;
      }
    });

    test('daily range covers full day in target timezone', async () => {
      // Dynamically import to pick up env change
      const { startOfDayInTz: startFn, endOfDayInTz: endFn } = await import('../routes/reports.js');

      const start = startFn('2026-06-13');
      const end = endFn('2026-06-13');

      // Start should be 2026-06-12 16:00 UTC
      expect(start.toISOString()).toBe('2026-06-12T16:00:00.000Z');
      // End should be 2026-06-13 15:59:59.999 UTC
      expect(end.toISOString()).toBe('2026-06-13T15:59:59.999Z');
      // Duration should be exactly 24h - 1ms
      expect(end.getTime() - start.getTime()).toBe(86400000 - 1);
    });

    test('weekly range is exactly 7 days minus 1ms', async () => {
      const { startOfDayInTz: startFn, endOfDayInTz: endFn } = await import('../routes/reports.js');

      const start = startFn('2026-06-07');
      const end = endFn('2026-06-13');

      expect(end.getTime() - start.getTime()).toBe(7 * 86400000 - 1);
    });
  });
});
