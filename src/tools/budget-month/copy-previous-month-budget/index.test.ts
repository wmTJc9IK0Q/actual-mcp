import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-month.js', () => ({
  copyPreviousMonth: vi.fn(),
  copyPreviousMonthForCategory: vi.fn(),
  getBudgetType: vi.fn(),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { copyPreviousMonth, copyPreviousMonthForCategory, getBudgetType } from '../../../api/budget-month.js';

const food = { id: 'cat-food', name: 'Food', budgeted: 0, balance: 0 };
const fun = { id: 'cat-fun', name: 'Fun', budgeted: 0, balance: 0 };
const month = '2026-09';

describe('copy-previous-month-budget tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBudgetType).mockResolvedValue('envelope');
  });

  it("copies every category's previous-month budget and reports only the changed ones", async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(100000, [food, fun]))
      .mockResolvedValueOnce(budgetMonth(0, [{ ...food, budgeted: 70000 }, fun]))
      .mockResolvedValueOnce(budgetMonth(30000, [{ ...food, budgeted: 70000, balance: 70000 }, fun]));

    const result = await handler({ month });

    expect(getBudgetMonth).toHaveBeenNthCalledWith(2, '2026-08');
    expect(copyPreviousMonth).toHaveBeenCalledWith(month);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Copied 2026-08 budgeted amounts into 2026-09');
    expect(text).toContain('Food: budgeted $0.00 → $700.00');
    expect(text).not.toContain('Fun:');
    expect(text).toContain('To Budget: $1,000.00 → $300.00');
  });

  it('copies a single category when categoryId is given', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(100000, [food, fun]))
      .mockResolvedValueOnce(budgetMonth(0, [food, { ...fun, budgeted: 5000 }]))
      .mockResolvedValueOnce(budgetMonth(95000, [food, { ...fun, budgeted: 5000, balance: 5000 }]));

    const result = await handler({ categoryId: 'cat-fun', month });

    expect(copyPreviousMonthForCategory).toHaveBeenCalledWith(month, 'cat-fun');
    expect(copyPreviousMonth).not.toHaveBeenCalled();
    expect(textContent(result.content[0])).toContain("Copied Fun's 2026-08 budget of $50.00 into 2026-09");
  });

  it('copies from December of the prior year into January', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [{ ...food, budgeted: 100 }]));

    await handler({ month: '2026-01' });

    expect(getBudgetMonth).toHaveBeenNthCalledWith(2, '2025-12');
  });

  it('refuses to copy an empty previous month over the current budget', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(0, [{ ...food, budgeted: 40000 }]))
      .mockResolvedValueOnce(budgetMonth(0, [food]));

    const result = await handler({ month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Nothing is budgeted in 2026-08');
    expect(copyPreviousMonth).not.toHaveBeenCalled();
  });

  it('rejects an income category in an envelope budget', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [food]));

    const result = await handler({ categoryId: 'cat-salary', month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('income category');
    expect(copyPreviousMonthForCategory).not.toHaveBeenCalled();
  });
});
