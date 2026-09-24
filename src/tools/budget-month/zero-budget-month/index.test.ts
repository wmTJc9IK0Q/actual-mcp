import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-month.js', () => ({
  zeroBudgetMonth: vi.fn(),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { zeroBudgetMonth } from '../../../api/budget-month.js';

const food = { id: 'cat-food', name: 'Food', budgeted: 40000, balance: 40000 };
const fun = { id: 'cat-fun', name: 'Fun', budgeted: 0, balance: 0 };
const month = '2026-09';

describe('zero-budget-month tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeroes the month and reports the categories that changed', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(10000, [food, fun]))
      .mockResolvedValueOnce(budgetMonth(50000, [{ ...food, budgeted: 0, balance: 0 }, fun]));

    const result = await handler({ month });

    expect(zeroBudgetMonth).toHaveBeenCalledWith(month);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Food: budgeted $400.00 → $0.00');
    expect(text).not.toContain('Fun:');
    expect(text).toContain('To Budget: $100.00 → $500.00');
  });

  it('says so when nothing was budgeted', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(10000, [fun]));

    const result = await handler({ month });

    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('No budgeted amounts changed.');
  });

  it('returns an error when Actual fails', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(10000, [food]));
    vi.mocked(zeroBudgetMonth).mockRejectedValueOnce(new Error('database is locked'));

    const result = await handler({ month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('database is locked');
  });
});
