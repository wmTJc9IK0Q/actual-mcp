import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';
import type * as BudgetMonthApi from '../../../api/budget-month.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-month.js', async (importOriginal) => ({
  ...(await importOriginal<typeof BudgetMonthApi>()),
  getBudgetType: vi.fn(),
  setAllBudgetsToAverage: vi.fn(),
  setCategoryBudgetToAverage: vi.fn(),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { getBudgetType, setAllBudgetsToAverage, setCategoryBudgetToAverage } from '../../../api/budget-month.js';

const food = { id: 'cat-food', name: 'Food', budgeted: 0, balance: 0 };
const month = '2026-09';

describe('set-budget-to-average tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBudgetType).mockResolvedValue('envelope');
  });

  it('sets every category to its 3-month average', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(100000, [food]))
      .mockResolvedValueOnce(budgetMonth(40000, [{ ...food, budgeted: 60000, balance: 60000 }]));

    const result = await handler({ months: 3, month });

    expect(setAllBudgetsToAverage).toHaveBeenCalledWith(month, 3);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('3-month average');
    expect(text).toContain('Food: budgeted $0.00 → $600.00');
  });

  it('sets one category to any N-month average', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(100000, [food]))
      .mockResolvedValueOnce(budgetMonth(25000, [{ ...food, budgeted: 75000, balance: 75000 }]));

    const result = await handler({ months: 2, categoryId: 'cat-food', month });

    expect(setCategoryBudgetToAverage).toHaveBeenCalledWith(month, 'cat-food', 2);
    expect(textContent(result.content[0])).toContain("Set Food's 2026-09 budget to its 2-month average of $750.00");
  });

  it('rejects averaging every category over a window Actual does not support', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [food]));

    const result = await handler({ months: 5, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('3, 6, or 12');
    expect(setAllBudgetsToAverage).not.toHaveBeenCalled();
  });

  it('allows an income category only in a tracking budget', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [food]));

    const envelope = await handler({ months: 3, categoryId: 'cat-salary', month });
    expect(envelope.isError).toBe(true);
    expect(setCategoryBudgetToAverage).not.toHaveBeenCalled();

    vi.mocked(getBudgetType).mockResolvedValue('tracking');
    const tracking = await handler({ months: 3, categoryId: 'cat-salary', month });
    expect(tracking.isError).toBeFalsy();
    expect(setCategoryBudgetToAverage).toHaveBeenCalledWith(month, 'cat-salary', 3);
  });

  it('rejects a non-integer month count', async () => {
    const result = await handler({ months: 1.5, month });

    expect(result.isError).toBe(true);
    expect(getBudgetMonth).not.toHaveBeenCalled();
  });
});
