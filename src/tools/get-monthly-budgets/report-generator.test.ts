import { describe, it, expect } from 'vitest';
import { MonthlyBudgetsReportGenerator } from './report-generator.js';
import type { BudgetMonth } from './types.js';

describe('MonthlyBudgetsReportGenerator', () => {
  const generator = new MonthlyBudgetsReportGenerator();

  it('renders an expense group with a subtotal row (happy path)', () => {
    const months: BudgetMonth[] = [
      {
        month: '2026-01',
        totalBudgeted: 80000,
        totalSpent: 80030,
        totalBalance: -30,
        totalIncome: 0,
        categoryGroups: [
          {
            id: 'grp-1',
            name: 'Everyday Expenses',
            categories: [
              { id: 'c1', name: 'Groceries', budgeted: 60000, spent: 54030, balance: 5970 },
              { id: 'c2', name: 'Dining', budgeted: 20000, spent: 26000, balance: -6000 },
            ],
          },
        ],
      },
    ];

    const markdown = generator.generate(months, { start: '2026-01', end: '2026-01' });

    expect(markdown).toContain('## 2026-01');
    expect(markdown).toContain('Budgeted: $800.00 | Spent: $800.30 | Balance: -$0.30');
    expect(markdown).toContain('### Everyday Expenses');
    expect(markdown).toContain('| Groceries | $600.00 | $540.30 | $59.70 |');
    expect(markdown).toContain('| Dining | $200.00 | $260.00 | -$60.00 |');
    // Subtotal is summed from the categories when the group carries no totals.
    expect(markdown).toContain('| **Total** | $800.00 | $800.30 | -$0.30 |');
  });

  it('uses received for income categories and marks carryover (edge case)', () => {
    const months: BudgetMonth[] = [
      {
        month: '2026-02',
        totalBudgeted: 0,
        totalSpent: 0,
        totalBalance: 10000,
        totalIncome: 500000,
        categoryGroups: [
          {
            id: 'grp-income',
            name: 'Income',
            is_income: true,
            received: 500000,
            categories: [{ id: 'ci', name: 'Salary', is_income: true, received: 500000 }],
          },
          {
            id: 'grp-bills',
            name: 'Bills',
            categories: [{ id: 'cb', name: 'Rent', budgeted: 150000, spent: 150000, balance: 10000, carryover: 1 }],
          },
        ],
      },
    ];

    const markdown = generator.generate(months, { start: '2026-02', end: '2026-02' });

    // Income category's `received` appears in the Spent column.
    expect(markdown).toContain('| Salary | $0.00 | $5,000.00 | $0.00 |');
    // Carryover flag renders an inline marker next to the balance.
    expect(markdown).toContain('| Rent | $1,500.00 | $1,500.00 | $100.00 ↩ |');
  });

  it('reports when there is no data for the range (failure/empty case)', () => {
    const markdown = generator.generate([], { start: '2020-01', end: '2020-03' });
    expect(markdown).toContain('Range: 2020-01 to 2020-03');
    expect(markdown).toContain('No budget data available for the requested range.');
  });
});
