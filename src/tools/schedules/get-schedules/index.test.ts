import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { accounts, payees, schedule } from '../test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getAccounts: vi.fn(),
  getPayees: vi.fn(),
}));

vi.mock('../../../api/schedules.js', () => ({
  getSchedules: vi.fn(),
}));

import { getAccounts, getPayees } from '../../../actual-api.js';
import { getSchedules } from '../../../api/schedules.js';

describe('get-schedules tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccounts).mockResolvedValue(accounts);
    vi.mocked(getPayees).mockResolvedValue(payees);
  });

  it('lists schedules with names, next date, amount and recurrence', async () => {
    vi.mocked(getSchedules).mockResolvedValue([schedule()]);

    const result = await handler({});

    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('"Rent" (id: sched-rent)');
    expect(text).toContain('Next date: 2026-10-01');
    expect(text).toContain('Amount: -$1,200.00 (is)');
    expect(text).toContain('Account: Checking | Payee: Landlord');
    expect(text).toContain('Recurrence: every month, starting 2026-09-01');
    expect(text).toContain('Auto-post transaction: no | Completed: no');
  });

  it('describes ranges, one-time dates, monthly patterns, end modes and weekend handling', async () => {
    vi.mocked(getSchedules).mockResolvedValue([
      schedule({ id: 's-range', name: 'Power', amountOp: 'isbetween', amount: { num1: -4000, num2: -8000 } }),
      schedule({ id: 's-once', name: undefined, date: '2026-12-24', account: undefined, payee: 'gone' }),
      schedule({
        id: 's-pattern',
        amountOp: 'isapprox',
        date: {
          frequency: 'monthly',
          interval: 2,
          start: '2026-09-01',
          endMode: 'after_n_occurrences',
          endOccurrences: 6,
          patterns: [
            { type: 'day', value: 15 },
            { type: 'day', value: -1 },
            { type: 'FR', value: 2 },
          ],
          skipWeekend: true,
          weekendSolveMode: 'before',
        },
      }),
      schedule({
        id: 's-until',
        date: { frequency: 'weekly', start: '2026-09-01', endMode: 'on_date', endDate: '2027-01-01' },
      }),
    ]);

    const text = textContent((await handler({})).content[0]);

    expect(text).toContain('Amount: between -$80.00 and -$40.00 (isbetween)');
    expect(text).toContain('(unnamed) (id: s-once)');
    expect(text).toContain('Recurrence: once on 2026-12-24');
    expect(text).toContain('Account: any | Payee: unknown (gone)');
    expect(text).toContain('Amount: approx. -$1,200.00 (isapprox)');
    expect(text).toContain(
      'every 2 months on the 15th, the last day, the 2nd Friday, starting 2026-09-01, 6 times; weekends move to the Friday before'
    );
    expect(text).toContain('every week, starting 2026-09-01, until 2027-01-01');
  });

  it('can hide completed schedules', async () => {
    vi.mocked(getSchedules).mockResolvedValue([schedule({ completed: true })]);

    expect(textContent((await handler({ includeCompleted: false })).content[0])).toBe('No active schedules found.');
    expect(textContent((await handler({})).content[0])).toContain('Completed: yes');
  });

  it('reports an empty budget', async () => {
    vi.mocked(getSchedules).mockResolvedValue([]);

    expect(textContent((await handler({})).content[0])).toBe('No schedules found.');
  });

  it('returns an error when Actual fails', async () => {
    vi.mocked(getSchedules).mockRejectedValue(new Error('budget not loaded'));

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('budget not loaded');
  });
});
