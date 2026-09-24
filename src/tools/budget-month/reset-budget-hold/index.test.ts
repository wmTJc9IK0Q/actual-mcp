import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-month.js', () => ({
  getBudgetType: vi.fn(),
  resetBudgetHold: vi.fn(),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { getBudgetType, resetBudgetHold } from '../../../api/budget-month.js';

const month = '2026-09';

describe('reset-budget-hold tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBudgetType).mockResolvedValue('envelope');
  });

  it('releases held money back into To Budget', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce({ ...budgetMonth(30000, []), forNextMonth: 20000 })
      .mockResolvedValueOnce(budgetMonth(50000, []));

    const result = await handler({ month });

    expect(resetBudgetHold).toHaveBeenCalledWith(month);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain("Released $200.00 held for next month back into 2026-09's To Budget");
    expect(text).toContain('To Budget: $300.00 → $500.00');
  });

  it('rejects when nothing is held', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(30000, []));

    const result = await handler({ month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('No money is held');
    expect(resetBudgetHold).not.toHaveBeenCalled();
  });

  it('rejects tracking budgets', async () => {
    vi.mocked(getBudgetType).mockResolvedValue('tracking');

    const result = await handler({ month });

    expect(result.isError).toBe(true);
    expect(resetBudgetHold).not.toHaveBeenCalled();
  });
});
