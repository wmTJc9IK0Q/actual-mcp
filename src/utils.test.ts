import { describe, it, expect } from 'vitest';
import { enumerateMonths, getCurrentMonth } from './utils.js';

describe('enumerateMonths', () => {
  it('lists every month inclusive within a year (happy path)', () => {
    expect(enumerateMonths('2026-01', '2026-04')).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
  });

  it('rolls across a year boundary (edge case)', () => {
    expect(enumerateMonths('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('returns a single month when start equals end', () => {
    expect(enumerateMonths('2026-06', '2026-06')).toEqual(['2026-06']);
  });

  it('returns empty when start is after end (failure case)', () => {
    expect(enumerateMonths('2026-06', '2026-01')).toEqual([]);
  });
});

describe('getCurrentMonth', () => {
  it('returns the current month in YYYY-MM format', () => {
    expect(getCurrentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
