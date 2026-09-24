import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-amounts.js', () => ({
  addBudgetFromToBudget: vi.fn(),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { addBudgetFromToBudget } from '../../../api/budget-amounts.js';

const food = { id: 'cat-food', name: 'Food', budgeted: 10000, balance: 10000 };

describe('add-budget-amount tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves money from To Budget into the category', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(5000, [food]))
      .mockResolvedValueOnce(budgetMonth(0, [{ ...food, budgeted: 15000, balance: 15000 }]));

    const result = await handler({ categoryId: 'cat-food', amount: 5000, month: '2026-09' });

    expect(addBudgetFromToBudget).toHaveBeenCalledWith('2026-09', 'cat-food', 5000);
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('To Budget: $50.00 → $0.00');
  });

  it('rejects an amount larger than To Budget instead of letting Actual clamp it', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(4999, [food]));

    const result = await handler({ categoryId: 'cat-food', amount: 5000, month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('only $49.99 is available');
    expect(addBudgetFromToBudget).not.toHaveBeenCalled();
  });

  it('rejects income categories', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(50000, [food]));

    const result = await handler({ categoryId: 'cat-salary', amount: 100, month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('income category');
    expect(addBudgetFromToBudget).not.toHaveBeenCalled();
  });

  it('rejects non-positive amounts', async () => {
    const result = await handler({ categoryId: 'cat-food', amount: 0 });

    expect(result.isError).toBe(true);
    expect(getBudgetMonth).not.toHaveBeenCalled();
  });
});
