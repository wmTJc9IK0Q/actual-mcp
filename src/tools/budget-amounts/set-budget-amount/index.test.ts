import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../test-fixtures.js';
import type * as Utils from '../../../utils.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
  setBudgetAmount: vi.fn(),
}));

vi.mock('../../../utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof Utils>()),
  getCurrentMonth: vi.fn(() => '2026-09'),
}));

import { getBudgetMonth, setBudgetAmount } from '../../../actual-api.js';

describe('set-budget-amount tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets the new total and reports before/after figures', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(50000, [{ id: 'cat-food', name: 'Food', budgeted: 10000, balance: 10000 }]))
      .mockResolvedValueOnce(budgetMonth(45000, [{ id: 'cat-food', name: 'Food', budgeted: 15000, balance: 15000 }]));

    const result = await handler({ categoryId: 'cat-food', amount: 15000, month: '2026-10' });

    expect(setBudgetAmount).toHaveBeenCalledWith('2026-10', 'cat-food', 15000);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('budgeted $100.00 → $150.00');
    expect(text).toContain('To Budget: $500.00 → $450.00');
  });

  it('defaults to the current month and allows setting zero', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(
      budgetMonth(0, [{ id: 'cat-food', name: 'Food', budgeted: 10000, balance: 10000 }])
    );

    await handler({ categoryId: 'cat-food', amount: 0 });

    expect(setBudgetAmount).toHaveBeenCalledWith('2026-09', 'cat-food', 0);
  });

  it('rejects an unknown category without changing the budget', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, []));

    const result = await handler({ categoryId: 'missing', amount: 100 });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('not found');
    expect(setBudgetAmount).not.toHaveBeenCalled();
  });

  it('rejects a fractional amount', async () => {
    const result = await handler({ categoryId: 'cat-food', amount: 12.5 });

    expect(result.isError).toBe(true);
    expect(getBudgetMonth).not.toHaveBeenCalled();
  });
});
