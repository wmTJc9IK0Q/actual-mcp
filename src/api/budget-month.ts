// ----------------------------
// ACTUAL API - BUDGET MONTH OPERATIONS
// ----------------------------

import * as api from '@actual-app/api';
import { getInternalSend, initActualApi } from '../actual-api.js';
import { getDefaultCurrencyCode } from './budget-amounts.js';

/** Actual's budgeting modes: envelope ("zero-based") or tracking ("report"). */
export type BudgetType = 'envelope' | 'tracking';

/** Averaging windows Actual can apply to every category at once. */
export type AllCategoryAverageMonths = 3 | 6 | 12;

const ALL_CATEGORY_AVERAGE_HANDLERS = {
  3: 'budget/set-3month-avg',
  6: 'budget/set-6month-avg',
  12: 'budget/set-12month-avg',
} as const;

/**
 * Check whether a month count has an all-categories averaging handler in Actual.
 *
 * @param months - Number of months to average over
 * @returns True when months is 3, 6 or 12
 */
export function isAllCategoryAverageMonths(months: number): months is AllCategoryAverageMonths {
  return months in ALL_CATEGORY_AVERAGE_HANDLERS;
}

/**
 * Read the budget's type preference. Actual treats a missing preference as envelope.
 *
 * @returns 'tracking' for tracking budgets, otherwise 'envelope'
 */
export async function getBudgetType(): Promise<BudgetType> {
  await initActualApi();
  const result = await api.aqlQuery(api.q('preferences').filter({ id: 'budgetType' }).select(['value']));
  if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
    const value: unknown = result.data[0]?.value;
    if (value === 'tracking') return 'tracking';
  }
  return 'envelope';
}

/**
 * Copy the previous month's budgeted amounts into a month for every visible category
 * that has a budget entry in the previous month (income categories are skipped for envelope budgets).
 *
 * @param month - Month in YYYY-MM format to copy into
 */
export async function copyPreviousMonth(month: string): Promise<void> {
  const send = await getInternalSend();
  return send('budget/copy-previous-month', { month });
}

/**
 * Copy one category's budgeted amount from the previous month into a month.
 *
 * @param month - Month in YYYY-MM format to copy into
 * @param categoryId - Category to copy
 */
export async function copyPreviousMonthForCategory(month: string, categoryId: string): Promise<void> {
  const send = await getInternalSend();
  return send('budget/copy-single-month', { month, category: categoryId });
}

/**
 * Set every visible category's budget to its average spending over the previous N months
 * (income categories are skipped for envelope budgets).
 *
 * @param month - Month in YYYY-MM format to set
 * @param months - Averaging window: 3, 6 or 12 months
 */
export async function setAllBudgetsToAverage(month: string, months: AllCategoryAverageMonths): Promise<void> {
  const send = await getInternalSend();
  return send(ALL_CATEGORY_AVERAGE_HANDLERS[months], { month });
}

/**
 * Set one category's budget to its average spending over the previous N months.
 *
 * @param month - Month in YYYY-MM format to set
 * @param categoryId - Category to set
 * @param months - Number of months to average over
 */
export async function setCategoryBudgetToAverage(month: string, categoryId: string, months: number): Promise<void> {
  const send = await getInternalSend();
  return send('budget/set-n-month-avg', { month, N: months, category: categoryId });
}

/**
 * Set every category's budgeted amount in a month to zero
 * (income categories are skipped for envelope budgets).
 *
 * @param month - Month in YYYY-MM format
 */
export async function zeroBudgetMonth(month: string): Promise<void> {
  const send = await getInternalSend();
  return send('budget/set-zero', { month });
}

/**
 * Hold money from "To Budget" for next month (envelope budgets). The amount is added to any
 * existing hold and Actual clamps it to the available "To Budget".
 *
 * @param month - Month in YYYY-MM format
 * @param amount - Amount in cents to add to the hold
 * @returns False when "To Budget" is not positive and nothing was held
 */
export async function holdBudgetForNextMonth(month: string, amount: number): Promise<boolean> {
  await initActualApi();
  return api.holdBudgetForNextMonth(month, amount);
}

/**
 * Release all money held for next month back into the month's "To Budget" (envelope budgets).
 *
 * @param month - Month in YYYY-MM format
 */
export async function resetBudgetHold(month: string): Promise<void> {
  await initActualApi();
  return api.resetBudgetHold(month);
}

/**
 * Turn rollover of a category's negative balance on or off, starting at a month and
 * applying to every later budget month.
 *
 * @param month - First month (YYYY-MM) to apply the setting to
 * @param categoryId - Expense category to update
 * @param enabled - Whether negative balances roll over
 */
export async function setBudgetCarryover(month: string, categoryId: string, enabled: boolean): Promise<void> {
  await initActualApi();
  return api.setBudgetCarryover(month, categoryId, enabled);
}

/**
 * Cover a negative "To Budget" by reducing a category's budgeted amount (envelope budgets).
 * Actual caps the covered amount at the category's balance and records it in the budget notes.
 *
 * @param month - Month in YYYY-MM format
 * @param fromCategoryId - Category giving up budgeted money
 * @param amount - Amount in cents; omit to cover the full over-budgeted amount
 */
export async function coverOverbudgeted(month: string, fromCategoryId: string, amount?: number): Promise<void> {
  const send = await getInternalSend();
  return send('budget/cover-overbudgeted', {
    month,
    category: fromCategoryId,
    amount,
    currencyCode: await getDefaultCurrencyCode(),
  });
}
