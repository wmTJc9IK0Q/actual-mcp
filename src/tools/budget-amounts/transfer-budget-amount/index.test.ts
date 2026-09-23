import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
  transferBudgetAmount: vi.fn(),
}));

import { getBudgetMonth, transferBudgetAmount } from '../../../actual-api.js';

const food = { id: 'cat-food', name: 'Food', budgeted: 10000, balance: 10000 };
const fun = { id: 'cat-fun', name: 'Fun', budgeted: 0, balance: 0 };

describe('transfer-budget-amount tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves money between two categories and reports both', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(0, [food, fun]))
      .mockResolvedValueOnce(
        budgetMonth(0, [
          { ...food, budgeted: 7000, balance: 7000 },
          { ...fun, budgeted: 3000, balance: 3000 },
        ])
      );

    const result = await handler({
      fromCategoryId: 'cat-food',
      toCategoryId: 'cat-fun',
      amount: 3000,
      month: '2026-09',
    });

    expect(transferBudgetAmount).toHaveBeenCalledWith('2026-09', 3000, 'cat-food', 'cat-fun');
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Food: budgeted $100.00 → $70.00');
    expect(text).toContain('Fun: budgeted $0.00 → $30.00');
  });

  it('rejects transferring a category to itself', async () => {
    const result = await handler({ fromCategoryId: 'cat-food', toCategoryId: 'cat-food', amount: 100 });

    expect(result.isError).toBe(true);
    expect(transferBudgetAmount).not.toHaveBeenCalled();
  });

  it('rejects an amount larger than the source balance', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [food, fun]));

    const result = await handler({
      fromCategoryId: 'cat-food',
      toCategoryId: 'cat-fun',
      amount: 10001,
      month: '2026-09',
    });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Food only has $100.00 available');
    expect(transferBudgetAmount).not.toHaveBeenCalled();
  });

  it('names the argument when the destination category is missing', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [food]));

    const result = await handler({ fromCategoryId: 'cat-food', toCategoryId: 'nope', amount: 100, month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('toCategoryId');
  });
});
