import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';

vi.mock('../../actual-api.js', () => ({
  getBudgetMonths: vi.fn(),
  getBudgetMonth: vi.fn(),
}));

import { getBudgetMonths, getBudgetMonth } from '../../actual-api.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const budgetMonth = (month: string): any => ({
  month,
  totalBudgeted: 60000,
  totalSpent: 54030,
  totalBalance: 5970,
  totalIncome: 0,
  categoryGroups: [
    {
      id: 'grp-1',
      name: 'Everyday Expenses',
      categories: [{ id: 'c1', name: 'Groceries', budgeted: 60000, spent: 54030, balance: 5970 }],
    },
  ],
});

describe('get-monthly-budgets tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one section per available month in the range (happy path)', async () => {
    vi.mocked(getBudgetMonths).mockResolvedValue(['2026-01', '2026-02', '2026-03']);
    vi.mocked(getBudgetMonth).mockImplementation(async (m: string) => budgetMonth(m));

    const result = await handler({ startMonth: '2026-01', endMonth: '2026-02' });

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('## 2026-01');
    expect(text).toContain('## 2026-02');
    expect(text).not.toContain('## 2026-03');
    expect(getBudgetMonth).toHaveBeenCalledTimes(2);
  });

  it('skips requested months that have no budget data (edge case)', async () => {
    vi.mocked(getBudgetMonths).mockResolvedValue(['2026-02']);
    vi.mocked(getBudgetMonth).mockImplementation(async (m: string) => budgetMonth(m));

    const result = await handler({ startMonth: '2026-01', endMonth: '2026-03' });

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('## 2026-02');
    expect(getBudgetMonth).toHaveBeenCalledTimes(1);
    expect(getBudgetMonth).toHaveBeenCalledWith('2026-02');
  });

  it('returns an error response when the API call fails (failure case)', async () => {
    vi.mocked(getBudgetMonths).mockRejectedValue(new Error('boom'));

    const result = await handler({ startMonth: '2026-01', endMonth: '2026-01' });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('boom');
  });
});
