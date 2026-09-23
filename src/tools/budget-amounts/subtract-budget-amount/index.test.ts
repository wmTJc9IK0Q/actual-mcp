import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  TO_BUDGET: 'to-budget',
  getBudgetMonth: vi.fn(),
  transferBudgetAmount: vi.fn(),
}));

import { getBudgetMonth, transferBudgetAmount } from '../../../actual-api.js';

describe('subtract-budget-amount tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns money from the category to To Budget', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(0, [{ id: 'cat-food', name: 'Food', budgeted: 10000, balance: 10000 }]))
      .mockResolvedValueOnce(budgetMonth(4000, [{ id: 'cat-food', name: 'Food', budgeted: 6000, balance: 6000 }]));

    const result = await handler({ categoryId: 'cat-food', amount: 4000, month: '2026-09' });

    expect(transferBudgetAmount).toHaveBeenCalledWith('2026-09', 4000, 'cat-food', 'to-budget');
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('To Budget: $0.00 → $40.00');
  });

  it('allows subtracting carried-over balance beyond this month’s budgeted amount', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(
      budgetMonth(0, [{ id: 'cat-food', name: 'Food', budgeted: 0, balance: 8000 }])
    );

    const result = await handler({ categoryId: 'cat-food', amount: 8000, month: '2026-09' });

    expect(result.isError).toBeFalsy();
    expect(transferBudgetAmount).toHaveBeenCalledWith('2026-09', 8000, 'cat-food', 'to-budget');
  });

  it('rejects an amount larger than the available balance', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(
      budgetMonth(0, [{ id: 'cat-food', name: 'Food', budgeted: 10000, balance: 2500 }])
    );

    const result = await handler({ categoryId: 'cat-food', amount: 2501, month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('only has $25.00 available');
    expect(transferBudgetAmount).not.toHaveBeenCalled();
  });
});
