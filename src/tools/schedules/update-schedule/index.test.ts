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
  updateSchedule: vi.fn(),
}));

import { getAccounts, getPayees } from '../../../actual-api.js';
import { getSchedules, updateSchedule } from '../../../api/schedules.js';

describe('update-schedule tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccounts).mockResolvedValue(accounts);
    vi.mocked(getPayees).mockResolvedValue(payees);
    vi.mocked(getSchedules).mockResolvedValue([schedule()]);
  });

  it('changes only the given fields and shows the updated schedule', async () => {
    vi.mocked(getSchedules)
      .mockResolvedValueOnce([schedule()])
      .mockResolvedValueOnce([schedule({ name: 'Rent 2027', amount: -125000 })]);

    const result = await handler({ id: 'sched-rent', name: 'Rent 2027', amount: -125000 });

    expect(result.isError).toBeFalsy();
    // Keeps the current operator and never sends keys the caller left out.
    expect(updateSchedule).toHaveBeenCalledWith(
      'sched-rent',
      { name: 'Rent 2027', amountOp: 'is', amount: -125000 },
      undefined
    );
    const text = textContent(result.content[0]);
    expect(text).toContain('"Rent 2027"');
    expect(text).toContain('Amount: -$1,250.00');
  });

  it('switches to a range when operator and range are sent together', async () => {
    await handler({ id: 'sched-rent', amountOp: 'isbetween', amount: { num1: -100000, num2: -130000 } });

    expect(updateSchedule).toHaveBeenCalledWith(
      'sched-rent',
      { amountOp: 'isbetween', amount: { num1: -100000, num2: -130000 } },
      undefined
    );
  });

  it('replaces the recurrence and forwards resetNextDate', async () => {
    await handler({ id: 'sched-rent', date: { frequency: 'yearly', start: '2027-01-01' }, resetNextDate: true });

    expect(updateSchedule).toHaveBeenCalledWith(
      'sched-rent',
      { date: { frequency: 'yearly', start: '2027-01-01', interval: 1, endMode: 'never' } },
      true
    );
  });

  it('allows resetting the next date on its own', async () => {
    const result = await handler({ id: 'sched-rent', resetNextDate: true });

    expect(result.isError).toBeFalsy();
    expect(updateSchedule).toHaveBeenCalledWith('sched-rent', {}, true);
  });

  it('rejects switching to isbetween without a range', async () => {
    const result = await handler({ id: 'sched-rent', amountOp: 'isbetween' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('requires amount as {num1, num2}');
    expect(updateSchedule).not.toHaveBeenCalled();
  });

  it('rejects a single amount on a range schedule unless the operator changes too', async () => {
    vi.mocked(getSchedules).mockResolvedValue([schedule({ amountOp: 'isbetween', amount: { num1: 1, num2: 2 } })]);

    expect((await handler({ id: 'sched-rent', amount: -5000 })).isError).toBe(true);
    expect(updateSchedule).not.toHaveBeenCalled();

    expect((await handler({ id: 'sched-rent', amount: -5000, amountOp: 'is' })).isError).toBeFalsy();
    expect(updateSchedule).toHaveBeenCalledWith('sched-rent', { amountOp: 'is', amount: -5000 }, undefined);
  });

  it('rejects enabling auto-post on a schedule without an account', async () => {
    vi.mocked(getSchedules).mockResolvedValue([schedule({ account: undefined })]);

    const result = await handler({ id: 'sched-rent', postsTransaction: true });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('requires an account');
    expect(updateSchedule).not.toHaveBeenCalled();
  });

  it('rejects an update with nothing to change', async () => {
    const result = await handler({ id: 'sched-rent' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Nothing to update');
  });

  it('rejects unknown schedules and payees', async () => {
    const missing = await handler({ id: 'nope', name: 'x' });
    expect(textContent(missing.content[0])).toContain('Schedule not found: nope');

    const badPayee = await handler({ id: 'sched-rent', payeeId: 'nope' });
    expect(textContent(badPayee.content[0])).toContain('Payee not found: nope');

    expect(updateSchedule).not.toHaveBeenCalled();
  });

  it('surfaces errors from Actual', async () => {
    vi.mocked(updateSchedule).mockRejectedValue(new Error('There is already a schedule named: Gym'));

    const result = await handler({ id: 'sched-rent', name: 'Gym' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('already a schedule named');
  });
});
