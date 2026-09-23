// ----------------------------
// BUDGET AMOUNTS - SHARED HELPERS
// ----------------------------

import { z } from 'zod';
import { getBudgetMonth } from '../../actual-api.js';
import { formatAmount } from '../../utils.js';
import type { BudgetMonth } from '../get-monthly-budgets/types.js';

export const PositiveAmountSchema = z
  .number()
  .int('amount must be an integer number of cents')
  .positive('amount must be greater than 0')
  .describe('Amount in cents as a positive integer. For example, $120.30 is 12030.');

export interface CategoryBudget {
  id: string;
  name: string;
  isIncome: boolean;
  /** Amount budgeted this month, in cents. */
  budgeted: number;
  /** Available balance (carryover + budgeted - spent), in cents. */
  balance: number;
}

export interface MonthBudgetSnapshot {
  month: string;
  /** "To Budget" amount in cents. */
  toBudget: number;
  categories: Map<string, CategoryBudget>;
}

/**
 * Load the per-category budget figures for a month.
 *
 * @param month - Month in YYYY-MM format
 * @returns Snapshot of "To Budget" and every category's budgeted amount and balance
 */
export async function loadMonthBudget(month: string): Promise<MonthBudgetSnapshot> {
  // Reason: getBudgetMonth types its category groups loosely (Record<string, unknown>);
  // BudgetMonth documents the fields we consume.
  const data = (await getBudgetMonth(month)) as unknown as BudgetMonth;
  const categories = new Map<string, CategoryBudget>();
  for (const group of data.categoryGroups) {
    for (const category of group.categories ?? []) {
      categories.set(category.id, {
        id: category.id,
        name: category.name,
        isIncome: Boolean(category.is_income ?? group.is_income),
        budgeted: category.budgeted ?? 0,
        balance: category.balance ?? 0,
      });
    }
  }
  return { month, toBudget: data.toBudget ?? 0, categories };
}

/**
 * Look up a budgetable (expense) category in a snapshot.
 *
 * @param snapshot - Month budget snapshot
 * @param categoryId - Category ID to find
 * @param field - Argument name, used in error messages
 * @returns The category's budget figures
 * @throws If the category does not exist or is an income category
 */
export function requireExpenseCategory(
  snapshot: MonthBudgetSnapshot,
  categoryId: string,
  field = 'categoryId'
): CategoryBudget {
  const category = snapshot.categories.get(categoryId);
  if (!category) {
    throw new Error(`${field}: category "${categoryId}" not found in the ${snapshot.month} budget`);
  }
  if (category.isIncome) {
    throw new Error(`${field}: "${category.name}" is an income category and cannot hold budgeted money`);
  }
  return category;
}

/**
 * Describe the before/after budget state of the given categories and "To Budget".
 *
 * @param before - Snapshot taken before the change
 * @param after - Snapshot taken after the change
 * @param categoryIds - Categories to report on
 * @returns Markdown lines summarizing the change
 */
export function describeChanges(
  before: MonthBudgetSnapshot,
  after: MonthBudgetSnapshot,
  categoryIds: string[]
): string {
  const lines = categoryIds.map((id) => {
    const prev = before.categories.get(id);
    const next = after.categories.get(id);
    const name = next?.name ?? prev?.name ?? id;
    return (
      `- ${name}: budgeted ${formatAmount(prev?.budgeted)} → ${formatAmount(next?.budgeted)}, ` +
      `balance ${formatAmount(prev?.balance)} → ${formatAmount(next?.balance)}`
    );
  });
  lines.push(`- To Budget: ${formatAmount(before.toBudget)} → ${formatAmount(after.toBudget)}`);
  return lines.join('\n');
}
