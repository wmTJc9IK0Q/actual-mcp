import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-month.js', () => ({
  setBudgetCarryover: vi.fn(),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { setBudgetCarryover } from '../../../api/budget-month.js';

const food = { id: 'cat-food', name: 'Food', budgeted: 0, balance: -500, carryover: false };
const month = '2026-09';

describe('set-budget-carryover tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('turns rollover on and reports the flag before and after', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(0, [food]))
      .mockResolvedValueOnce(budgetMonth(0, [{ ...food, carryover: true }]));

    const result = await handler({ categoryId: 'cat-food', enabled: true, month });

    expect(setBudgetCarryover).toHaveBeenCalledWith(month, 'cat-food', true);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Turned rollover on for Food from 2026-09 onward');
    expect(text).toContain('Rollover in 2026-09: off → on');
  });

  it('rejects an income category', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [food]));

    const result = await handler({ categoryId: 'cat-salary', enabled: true, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('income category');
    expect(setBudgetCarryover).not.toHaveBeenCalled();
  });

  it('rejects an unknown category', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [food]));

    const result = await handler({ categoryId: 'nope', enabled: false, month });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('not found');
    expect(setBudgetCarryover).not.toHaveBeenCalled();
  });
});
