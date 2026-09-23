import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
  coverOverspending: vi.fn(),
}));

import { getBudgetMonth, coverOverspending } from '../../../actual-api.js';

const overspent = { id: 'cat-dining', name: 'Dining', budgeted: 0, balance: -3000 };
const savings = { id: 'cat-save', name: 'Savings', budgeted: 10000, balance: 10000 };
const month = '2026-09';

describe('cover-overspending tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('covers the full overspending when amount is omitted', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [overspent, savings]));

    const result = await handler({ categoryId: 'cat-dining', fromCategoryId: 'cat-save', month });

    expect(coverOverspending).toHaveBeenCalledWith(month, 'cat-dining', 'cat-save', undefined);
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain("Covered $30.00 of Dining's $30.00 overspending from Savings");
  });

  it('reports a partial cover when the source has less than the overspending', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(
      budgetMonth(0, [overspent, { ...savings, budgeted: 1000, balance: 1000 }])
    );

    const result = await handler({ categoryId: 'cat-dining', fromCategoryId: 'cat-save', month });

    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain("Covered $10.00 of Dining's $30.00 overspending");
  });

  it('rejects covering a category that is not overspent', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [{ ...overspent, balance: 0 }, savings]));

    const result = await handler({ categoryId: 'cat-dining', fromCategoryId: 'cat-save', month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('not overspent');
    expect(coverOverspending).not.toHaveBeenCalled();
  });

  it('rejects a source category with no available balance', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [overspent, { ...savings, balance: 0 }]));

    const result = await handler({ categoryId: 'cat-dining', fromCategoryId: 'cat-save', month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('no available balance');
    expect(coverOverspending).not.toHaveBeenCalled();
  });

  it('rejects an amount larger than the overspending', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [overspent, savings]));

    const result = await handler({ categoryId: 'cat-dining', fromCategoryId: 'cat-save', amount: 3001, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('transfer-budget-amount');
    expect(coverOverspending).not.toHaveBeenCalled();
  });
});
