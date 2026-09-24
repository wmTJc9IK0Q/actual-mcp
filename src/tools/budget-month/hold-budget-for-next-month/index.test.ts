import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-month.js', () => ({
  getBudgetType: vi.fn(),
  holdBudgetForNextMonth: vi.fn(),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { getBudgetType, holdBudgetForNextMonth } from '../../../api/budget-month.js';

const month = '2026-09';

describe('hold-budget-for-next-month tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBudgetType).mockResolvedValue('envelope');
    vi.mocked(holdBudgetForNextMonth).mockResolvedValue(true);
  });

  it('holds part of To Budget and reports the new hold', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce({ ...budgetMonth(50000, []), forNextMonth: 10000 })
      .mockResolvedValueOnce({ ...budgetMonth(30000, []), forNextMonth: 30000 });

    const result = await handler({ amount: 20000, month });

    expect(holdBudgetForNextMonth).toHaveBeenCalledWith(month, 20000);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain("Held $200.00 of 2026-09's To Budget for next month");
    expect(text).toContain('Held for next month: $100.00 → $300.00');
    expect(text).toContain('To Budget: $500.00 → $300.00');
  });

  it('rejects an amount larger than To Budget instead of letting Actual clamp it', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(50000, []));

    const result = await handler({ amount: 50001, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('exceeds the $500.00 available');
    expect(holdBudgetForNextMonth).not.toHaveBeenCalled();
  });

  it('rejects holding when To Budget is not positive', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(-100, []));

    const result = await handler({ amount: 100, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('No money is available to hold');
    expect(holdBudgetForNextMonth).not.toHaveBeenCalled();
  });

  it('reports an error when Actual declines the hold', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(50000, []));
    vi.mocked(holdBudgetForNextMonth).mockResolvedValue(false);

    const result = await handler({ amount: 100, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('did not hold');
  });

  it('rejects tracking budgets', async () => {
    vi.mocked(getBudgetType).mockResolvedValue('tracking');

    const result = await handler({ amount: 100, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('only available for envelope budgets');
    expect(holdBudgetForNextMonth).not.toHaveBeenCalled();
  });
});
