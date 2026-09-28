import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { budgetMonth } from '../../budget-amounts/test-fixtures.js';
import type * as UtilsModule from '../../../utils.js';

vi.mock('../../../actual-api.js', () => ({
  getCategories: vi.fn(),
  getBudgetMonth: vi.fn(),
}));

vi.mock('../../../api/budget-templates.js', () => ({
  applyCategoryBudgetTemplates: vi.fn(),
  checkBudgetTemplates: vi.fn(),
}));

vi.mock('../../../utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof UtilsModule>()),
  getCurrentMonth: vi.fn(() => '2026-09'),
}));

import { getBudgetMonth, getCategories } from '../../../actual-api.js';
import { applyCategoryBudgetTemplates, checkBudgetTemplates } from '../../../api/budget-templates.js';

const rent = { id: 'cat-rent', name: 'Rent', budgeted: 55555, balance: 55555 };
const food = { id: 'cat-food', name: 'Food', budgeted: 0, balance: 0 };
const broken = { id: 'cat-broken', name: 'Broken', budgeted: 7777, balance: 7777 };

describe('apply-category-budget-templates tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([
      { id: 'grp-expense', name: 'Expenses', is_income: false, hidden: false },
      { id: 'cat-rent', name: 'Rent', group_id: 'grp-expense' },
      { id: 'cat-food', name: 'Food', group_id: 'grp-expense' },
      { id: 'cat-broken', name: 'Broken', group_id: 'grp-expense' },
    ]);
    vi.mocked(checkBudgetTemplates).mockResolvedValue({ type: 'message', message: 'templates-check-passed' });
  });

  it('overwrites only the selected categories and reports their before/after', async () => {
    vi.mocked(getBudgetMonth)
      .mockResolvedValueOnce(budgetMonth(100000, [rent, food]))
      .mockResolvedValueOnce(budgetMonth(145555, [{ ...rent, budgeted: 10000, balance: 10000 }, food]));
    vi.mocked(applyCategoryBudgetTemplates).mockResolvedValue({
      type: 'message',
      message: 'templates-applied',
      count: 1,
    });

    const result = await handler({ categoryIds: ['cat-rent', 'cat-rent'], month: '2026-10' });

    expect(applyCategoryBudgetTemplates).toHaveBeenCalledWith('2026-10', ['cat-rent']);
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Rent: budgeted $555.55 → $100.00');
    expect(text).not.toContain('Food');
  });

  it('defaults to the current month', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [rent]));
    vi.mocked(applyCategoryBudgetTemplates).mockResolvedValue({ type: 'message', message: 'templates-up-to-date' });

    await handler({ categoryIds: ['cat-rent'] });

    expect(applyCategoryBudgetTemplates).toHaveBeenCalledWith('2026-09', ['cat-rent']);
  });

  it('rejects an empty category list without calling the API', async () => {
    const result = await handler({ categoryIds: [], month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(applyCategoryBudgetTemplates).not.toHaveBeenCalled();
  });

  it('rejects unknown category IDs, including category group IDs', async () => {
    const result = await handler({ categoryIds: ['cat-rent', 'nope', 'grp-expense'], month: '2026-09' });

    expect(result.isError).toBe(true);
    const text = textContent(result.content[0]);
    expect(text).toContain('nope');
    expect(text).toContain('grp-expense');
    expect(applyCategoryBudgetTemplates).not.toHaveBeenCalled();
  });

  it('refuses to apply when a selected category has a template syntax error', async () => {
    vi.mocked(checkBudgetTemplates).mockResolvedValue({
      sticky: true,
      message: 'template-errors',
      pre: 'Broken: #template garbage words\n\nOther: #template nonsense',
    });

    const result = await handler({ categoryIds: ['cat-broken', 'cat-food'], month: '2026-09' });

    expect(result.isError).toBe(true);
    const text = textContent(result.content[0]);
    expect(text).toContain('Broken: #template garbage words');
    expect(text).not.toContain('Other:');
    expect(applyCategoryBudgetTemplates).not.toHaveBeenCalled();
  });

  it('ignores template errors in categories that were not selected', async () => {
    vi.mocked(checkBudgetTemplates).mockResolvedValue({
      sticky: true,
      message: 'template-errors',
      pre: 'Broken: #template garbage words',
    });
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [rent, broken]));
    vi.mocked(applyCategoryBudgetTemplates).mockResolvedValue({ type: 'message', message: 'templates-up-to-date' });

    const result = await handler({ categoryIds: ['cat-rent'], month: '2026-09' });

    expect(result.isError).toBeFalsy();
    expect(applyCategoryBudgetTemplates).toHaveBeenCalledWith('2026-09', ['cat-rent']);
  });

  it('reports errors Actual returns while applying', async () => {
    vi.mocked(getBudgetMonth).mockResolvedValue(budgetMonth(0, [rent]));
    vi.mocked(applyCategoryBudgetTemplates).mockResolvedValue({
      sticky: true,
      message: 'template-errors',
      pre: 'Rent: Schedule "Lease" does not exist',
    });

    const result = await handler({ categoryIds: ['cat-rent'], month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Schedule "Lease" does not exist');
  });
});
