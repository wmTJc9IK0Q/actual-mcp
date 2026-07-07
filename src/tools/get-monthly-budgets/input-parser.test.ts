import { describe, it, expect, vi, afterEach } from 'vitest';
import { MonthlyBudgetsInputParser } from './input-parser.js';

// getCurrentMonth reads the system clock; mock it so defaults are deterministic.
vi.mock('../../utils.js', () => ({
  getCurrentMonth: () => '2026-07',
}));

describe('MonthlyBudgetsInputParser', () => {
  const parser = new MonthlyBudgetsInputParser();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the inclusive range when both months are provided (happy path)', () => {
    expect(parser.parse({ startMonth: '2026-01', endMonth: '2026-06' })).toEqual({
      startMonth: '2026-01',
      endMonth: '2026-06',
    });
  });

  it('defaults to the current month when nothing is provided (edge case)', () => {
    expect(parser.parse({})).toEqual({ startMonth: '2026-07', endMonth: '2026-07' });
    expect(parser.parse(undefined)).toEqual({ startMonth: '2026-07', endMonth: '2026-07' });
  });

  it('extends only-startMonth through the current month', () => {
    expect(parser.parse({ startMonth: '2026-01' })).toEqual({ startMonth: '2026-01', endMonth: '2026-07' });
  });

  it('treats a future only-startMonth as a single month', () => {
    expect(parser.parse({ startMonth: '2026-12' })).toEqual({ startMonth: '2026-12', endMonth: '2026-12' });
  });

  it('treats only-endMonth as a single month', () => {
    expect(parser.parse({ endMonth: '2026-03' })).toEqual({ startMonth: '2026-03', endMonth: '2026-03' });
  });

  it('rejects a malformed month (failure case)', () => {
    expect(() => parser.parse({ startMonth: '2026/01' })).toThrow(/YYYY-MM/);
    expect(() => parser.parse({ endMonth: 'not-a-month' })).toThrow(/YYYY-MM/);
  });

  it('rejects a start month after the end month', () => {
    expect(() => parser.parse({ startMonth: '2026-06', endMonth: '2026-01' })).toThrow(
      /startMonth must be before or equal to endMonth/
    );
  });
});
