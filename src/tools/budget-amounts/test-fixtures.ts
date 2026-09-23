// Test fixture for budget-amount tools: builds a getBudgetMonth()-shaped response.
import type { getBudgetMonth } from '../../actual-api.js';
import type { BudgetCategory } from '../get-monthly-budgets/types.js';

// Reason: the Actual API does not export a name for getBudgetMonth()'s result; the fixture must match its mock.
type ApiBudgetMonthFixture = Awaited<ReturnType<typeof getBudgetMonth>>;

/** Category fixture as a plain type alias so it satisfies the API's Record<string, unknown> shape. */
type CategoryFixture = { [K in keyof BudgetCategory]: BudgetCategory[K] };

/**
 * Build a budget month with one expense group and one income group.
 *
 * @param toBudget - "To Budget" amount in cents
 * @param categories - Expense categories (id, name, budgeted, balance)
 * @returns A BudgetMonth usable as a mocked getBudgetMonth() result
 */
export function budgetMonth(toBudget: number, categories: CategoryFixture[]): ApiBudgetMonthFixture {
  return {
    month: '2026-09',
    toBudget,
    incomeAvailable: 0,
    lastMonthOverspent: 0,
    forNextMonth: 0,
    fromLastMonth: 0,
    totalBudgeted: 0,
    totalSpent: 0,
    totalBalance: 0,
    totalIncome: 0,
    categoryGroups: [
      { id: 'grp-expense', name: 'Expenses', categories },
      {
        id: 'grp-income',
        name: 'Income',
        is_income: true,
        categories: [{ id: 'cat-salary', name: 'Salary', is_income: true, received: 500000 }],
      },
    ],
  };
}
