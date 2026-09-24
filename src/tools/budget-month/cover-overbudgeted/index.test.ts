import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-month.js', () => ({
  getBudgetType: vi.fn(),
  coverOverbudgeted: vi.fn(),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { coverOverbudgeted, getBudgetType } from '../../../api/budget-month.js';

const savings = { id: 'cat-save', name: 'Savings', budgeted: 10000, balance: 10000 };
const month = '2026-09';

describe('cover-overbudgeted tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBudgetType).mockResolvedValue('envelope');
  });

  it('covers the full shortfall when amount is omitted', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(-3000, [savings]))
      .mockResolvedValueOnce(budgetMonth(0, [{ ...savings, budgeted: 7000, balance: 7000 }]));

    const result = await handler({ fromCategoryId: 'cat-save', month });

    expect(coverOverbudgeted).toHaveBeenCalledWith(month, 'cat-save', undefined);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Covered $30.00 of the $30.00 over-budgeted in 2026-09 from Savings');
    expect(text).toContain('Savings: budgeted $100.00 → $70.00');
    expect(text).toContain('To Budget: -$30.00 → $0.00');
  });

  it('reports a partial cover when the source has less than the shortfall', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(-30000, [savings]));

    const result = await handler({ fromCategoryId: 'cat-save', month });

    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('Covered $100.00 of the $300.00 over-budgeted');
  });

  it('rejects a month that is not over-budgeted', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [savings]));

    const result = await handler({ fromCategoryId: 'cat-save', amount: 100, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('not over-budgeted');
    expect(coverOverbudgeted).not.toHaveBeenCalled();
  });

  it('rejects a source category with no available balance', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(-3000, [{ ...savings, balance: 0 }]));

    const result = await handler({ fromCategoryId: 'cat-save', month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('no available balance');
    expect(coverOverbudgeted).not.toHaveBeenCalled();
  });

  it('rejects an amount larger than the shortfall', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(-3000, [savings]));

    const result = await handler({ fromCategoryId: 'cat-save', amount: 3001, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('subtract-budget-amount');
    expect(coverOverbudgeted).not.toHaveBeenCalled();
  });

  it('rejects tracking budgets', async () => {
    vi.mocked(getBudgetType).mockResolvedValue('tracking');

    const result = await handler({ fromCategoryId: 'cat-save', month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('only available for envelope budgets');
    expect(coverOverbudgeted).not.toHaveBeenCalled();
  });
});
