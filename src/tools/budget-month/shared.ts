// ----------------------------
// BUDGET MONTH OPERATIONS - SHARED HELPERS
// ----------------------------

import { getBudgetMonth } from '../../actual-api.js';
import { getBudgetType } from '../../api/budget-month.js';
import type { BudgetType } from '../../api/budget-month.js';
import { formatAmount } from '../../utils.js';
import { describeChanges, requireExpenseCategory } from '../budget-amounts/shared.js';
import type { CategoryBudget, MonthBudgetSnapshot } from '../budget-amounts/shared.js';

/** A month's "To Budget" and the amount held from it for next month, in cents. */
export interface HoldState {
  toBudget: number;
  held: number;
}

/**
 * Get the month before a YYYY-MM month.
 *
 * @param month - Month in YYYY-MM format
 * @returns The previous month in YYYY-MM format
 */
export function previousMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  return mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`;
}

/**
 * Throw unless the open budget uses envelope budgeting.
 *
 * @param operation - Human-readable name of the operation, used in the error message
 * @throws If the budget is a tracking budget
 */
export async function requireEnvelopeBudget(operation: string): Promise<void> {
  if ((await getBudgetType()) === 'tracking') {
    throw new Error(`${operation} is only available for envelope budgets; this budget uses tracking budgeting`);
  }
}

/**
 * Look up a category that can hold a budgeted amount: expense categories always,
 * income categories only in tracking budgets.
 *
 * @param snapshot - Month budget snapshot
 * @param categoryId - Category ID to find
 * @param budgetType - The budget's type
 * @returns The category's budget figures
 * @throws If the category does not exist, or is an income category in an envelope budget
 */
export function requireBudgetableCategory(
  snapshot: MonthBudgetSnapshot,
  categoryId: string,
  budgetType: BudgetType
): CategoryBudget {
  const category = snapshot.categories.get(categoryId);
  if (budgetType === 'tracking' && category) return category;
  return requireExpenseCategory(snapshot, categoryId);
}

/**
 * Summarize every category whose budgeted amount changed between two snapshots, plus "To Budget".
 *
 * @param before - Snapshot taken before the change
 * @param after - Snapshot taken after the change
 * @returns Markdown lines for the changed categories, or a note that nothing changed
 */
export function describeBudgetedChanges(before: MonthBudgetSnapshot, after: MonthBudgetSnapshot): string {
  const changed = [...after.categories.values()]
    .filter((category) => before.categories.get(category.id)?.budgeted !== category.budgeted)
    .map((category) => category.id);
  const summary = describeChanges(before, after, changed);
  return changed.length === 0 ? `No budgeted amounts changed.\n${summary}` : summary;
}

/**
 * Load a month's "To Budget" and the amount manually held for next month.
 *
 * @param month - Month in YYYY-MM format
 * @returns The month's hold state
 */
export async function loadHoldState(month: string): Promise<HoldState> {
  const data = await getBudgetMonth(month);
  return { toBudget: data.toBudget, held: data.forNextMonth };
}

/**
 * Describe the before/after held amount and "To Budget" for a month.
 *
 * @param before - Hold state before the change
 * @param after - Hold state after the change
 * @returns Markdown lines summarizing the change
 */
export function describeHoldChanges(before: HoldState, after: HoldState): string {
  return (
    `- Held for next month: ${formatAmount(before.held)} → ${formatAmount(after.held)}\n` +
    `- To Budget: ${formatAmount(before.toBudget)} → ${formatAmount(after.toBudget)}`
  );
}
