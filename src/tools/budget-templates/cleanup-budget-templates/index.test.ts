import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';
import type * as UtilsModule from '../../../utils.js';

vi.mock('../../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-templates.js', () => ({
  cleanupBudgetTemplates: vi.fn(),
}));

vi.mock('../../../utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof UtilsModule>()),
  getCurrentMonth: vi.fn(() => '2026-09'),
}));

import { getBudgetMonth } from '../../../actual-api.js';
import { cleanupBudgetTemplates } from '../../../api/budget-templates.js';

const leftover = { id: 'cat-leftover', name: 'Leftover', budgeted: 5000, balance: 3000 };
const savings = { id: 'cat-savings', name: 'Savings', budgeted: 1000, balance: 1000 };
const rent = { id: 'cat-rent', name: 'Rent', budgeted: 10000, balance: 10000 };

describe('cleanup-budget-templates tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs cleanup for the month and reports only the categories whose budget changed', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(2000, [leftover, savings, rent]))
      .mockResolvedValueOnce(
        budgetMonth(0, [
          { ...leftover, budgeted: 2000, balance: 0 },
          { ...savings, budgeted: 6000, balance: 6000 },
          rent,
        ])
      );
    vi.mocked(cleanupBudgetTemplates).mockResolvedValue({
      type: 'message',
      message: 'cleanup-applied',
      sourceCount: 1,
      sinkCount: 1,
    });

    const result = await handler({ month: '2026-08' });

    expect(cleanupBudgetTemplates).toHaveBeenCalledWith('2026-08');
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Returned funds from 1 sources and funded 1 sinking funds.');
    expect(text).toContain('Leftover: budgeted $50.00 → $20.00');
    expect(text).toContain('Savings: budgeted $10.00 → $60.00');
    expect(text).toContain('To Budget: $20.00 → $0.00');
    expect(text).not.toContain('Rent');
  });

  it('defaults to the current month and says when nothing changed', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [leftover, savings]));
    vi.mocked(cleanupBudgetTemplates).mockResolvedValue({
      type: 'message',
      message: 'cleanup-up-to-date',
    });

    const result = await handler({});

    expect(cleanupBudgetTemplates).toHaveBeenCalledWith('2026-09');
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('No budgeted amounts changed.');
  });

  it('reports warnings as a successful result because money may still have moved', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(500, [leftover, savings]))
      .mockResolvedValueOnce(budgetMonth(0, [leftover, { ...savings, budgeted: 1500, balance: 1500 }]));
    vi.mocked(cleanupBudgetTemplates).mockResolvedValue({
      type: 'warning',
      message: 'cleanup-no-funds',
      pre: 'Dining does not have available funds.',
    });

    const result = await handler({ month: '2026-09' });

    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Dining does not have available funds.');
    expect(text).toContain('Savings: budgeted $10.00 → $15.00');
  });

  it('reports an error notification from Actual as a tool error', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [leftover]));
    vi.mocked(cleanupBudgetTemplates).mockResolvedValue({
      // Reason: Actual 26.9 marks cleanup template errors only by message key, not `type: 'error'`.
      sticky: true,
      message: 'template-errors',
      pre: 'Leftover: bad cleanup line',
    });

    const result = await handler({ month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Leftover: bad cleanup line');
  });

  it('refuses to run while To Budget is negative', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(-4000, [leftover, savings]));

    const result = await handler({ month: '2026-10' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('-$40.00');
    expect(cleanupBudgetTemplates).not.toHaveBeenCalled();
  });

  it('rejects a malformed month without calling the API', async () => {
    const result = await handler({ month: 'September' });

    expect(result.isError).toBe(true);
    expect(cleanupBudgetTemplates).not.toHaveBeenCalled();
  });
});
