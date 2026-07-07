// Type definitions for the get-monthly-budgets tool.
//
// These mirror the shape returned by the Actual API's getBudgetMonth(), which
// types its category groups loosely as Record<string, unknown>. Expense groups
// and categories carry `spent`; income groups/categories carry `received`
// instead. All monetary values are integers in cents.

export interface BudgetCategory {
  id: string;
  name: string;
  is_income?: boolean;
  budgeted?: number;
  spent?: number;
  received?: number;
  balance?: number;
  carryover?: number | boolean;
}

export interface BudgetCategoryGroup {
  id: string;
  name: string;
  is_income?: boolean;
  budgeted?: number;
  spent?: number;
  received?: number;
  balance?: number;
  categories?: BudgetCategory[];
}

export interface BudgetMonth {
  month: string;
  totalBudgeted: number;
  totalSpent: number;
  totalBalance: number;
  totalIncome: number;
  categoryGroups: BudgetCategoryGroup[];
}
