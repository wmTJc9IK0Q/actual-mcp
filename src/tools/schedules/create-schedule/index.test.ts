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
  createSchedule: vi.fn(),
}));

import { getAccounts, getPayees } from '../../../actual-api.js';
import { createSchedule, getSchedules } from '../../../api/schedules.js';

type CreateArgs = Parameters<typeof handler>[0];

describe('create-schedule tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccounts).mockResolvedValue(accounts);
    vi.mocked(getPayees).mockResolvedValue(payees);
    vi.mocked(createSchedule).mockResolvedValue('sched-rent');
    vi.mocked(getSchedules).mockResolvedValue([schedule({ amountOp: 'isapprox' })]);
  });

  it('creates a monthly schedule with explicit recurrence defaults and reports its next date', async () => {
    const result = await handler({
      name: 'Rent',
      date: { frequency: 'monthly', start: '2026-09-01' },
      amount: -120000,
      accountId: 'acct-checking',
      payeeId: 'payee-landlord',
    });

    expect(result.isError).toBeFalsy();
    expect(createSchedule).toHaveBeenCalledWith({
      name: 'Rent',
      postsTransaction: false,
      accountId: 'acct-checking',
      payeeId: 'payee-landlord',
      amount: { op: 'isapprox', value: -120000 },
      date: { frequency: 'monthly', start: '2026-09-01', interval: 1, endMode: 'never' },
    });
    const text = textContent(result.content[0]);
    expect(text).toContain('Created schedule');
    expect(text).toContain('Next date: 2026-10-01');
  });

  it('infers isbetween for a range amount and defaults the weekend solve mode', async () => {
    await handler({
      date: { frequency: 'weekly', start: '2026-09-04', skipWeekend: true },
      amount: { num1: -4000, num2: -8000 },
    });

    expect(createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: { op: 'isbetween', value: { num1: -4000, num2: -8000 } },
        date: expect.objectContaining({ skipWeekend: true, weekendSolveMode: 'after' }),
      })
    );
  });

  it('accepts a one-time date', async () => {
    await handler({ date: '2026-12-24', amount: 5000, amountOp: 'is' });

    expect(createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-12-24', amount: { op: 'is', value: 5000 } })
    );
  });

  it.each<[string, CreateArgs, string]>([
    ['impossible date', { date: '2026-02-30', amount: 1 }, 'valid calendar date'],
    [
      'missing endOccurrences',
      { date: { frequency: 'monthly', start: '2026-09-01', endMode: 'after_n_occurrences' }, amount: 1 },
      'endOccurrences is required',
    ],
    [
      'endDate before start',
      { date: { frequency: 'monthly', start: '2026-09-01', endMode: 'on_date', endDate: '2026-08-01' }, amount: 1 },
      'endDate must not be before start',
    ],
    [
      'patterns on a weekly schedule',
      { date: { frequency: 'weekly', start: '2026-09-01', patterns: [{ type: 'MO', value: 1 }] }, amount: 1 },
      'only supported for monthly',
    ],
    [
      'out-of-range day pattern',
      { date: { frequency: 'monthly', start: '2026-09-01', patterns: [{ type: 'day', value: 32 }] }, amount: 1 },
      'must be 1-31 or -1',
    ],
    [
      'range with a single-value operator',
      { date: '2026-10-01', amount: { num1: 1, num2: 2 }, amountOp: 'is' },
      'only valid with amountOp "isbetween"',
    ],
    [
      'isbetween with a single number',
      { date: '2026-10-01', amount: 1, amountOp: 'isbetween' },
      'requires amount as {num1, num2}',
    ],
    ['auto-post without an account', { date: '2026-10-01', amount: 1, postsTransaction: true }, 'requires accountId'],
    ['unknown account', { date: '2026-10-01', amount: 1, accountId: 'nope' }, 'Account not found: nope'],
    ['unknown payee', { date: '2026-10-01', amount: 1, payeeId: 'nope' }, 'Payee not found: nope'],
  ])('rejects %s without creating anything', async (_label, args, message) => {
    const result = await handler(args);

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain(message);
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it('surfaces errors from Actual, such as duplicate names', async () => {
    vi.mocked(createSchedule).mockRejectedValue(new Error('Cannot create schedules with the same name'));

    const result = await handler({ name: 'Rent', date: '2026-10-01', amount: -100 });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('same name');
  });
});
