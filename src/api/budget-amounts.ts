// ----------------------------
// ACTUAL API - BUDGET AMOUNTS
// ----------------------------

import * as api from '@actual-app/api';
import { getInternalSend, initActualApi } from '../actual-api.js';

/** Special budget target meaning Actual's "To Budget" pool. */
export const TO_BUDGET = 'to-budget';

/**
 * Set a category's budgeted amount for a month to an exact value (ensures API is initialized).
 *
 * @param month - Month in YYYY-MM format
 * @param categoryId - Category to update
 * @param amount - New budgeted amount in cents
 */
export async function setBudgetAmount(month: string, categoryId: string, amount: number): Promise<void> {
  await initActualApi();
  return api.setBudgetAmount(month, categoryId, amount);
}

/**
 * Move money from "To Budget" into a category (Actual's "Transfer from To Budget").
 * Actual clamps the amount to what is available in "To Budget".
 *
 * @param month - Month in YYYY-MM format
 * @param categoryId - Category receiving the money
 * @param amount - Amount in cents
 */
export async function addBudgetFromToBudget(month: string, categoryId: string, amount: number): Promise<void> {
  const send = await getInternalSend();
  return send('budget/transfer-available', { month, amount, category: categoryId });
}

/**
 * Move budgeted money out of a category into another category or back to "To Budget".
 * Actual records the movement in the month's budget notes.
 *
 * @param month - Month in YYYY-MM format
 * @param amount - Amount in cents
 * @param fromCategoryId - Category giving up the money
 * @param to - Receiving category ID, or TO_BUDGET
 */
export async function transferBudgetAmount(
  month: string,
  amount: number,
  fromCategoryId: string,
  to: string
): Promise<void> {
  const send = await getInternalSend();
  return send('budget/transfer-category', {
    month,
    amount,
    from: fromCategoryId,
    to,
    currencyCode: await getDefaultCurrencyCode(),
  });
}

/**
 * Cover a category's overspending using another category's available balance.
 * Actual caps the covered amount at the source category's balance and records it in the budget notes.
 *
 * @param month - Month in YYYY-MM format
 * @param toCategoryId - Overspent category to cover
 * @param fromCategoryId - Category providing the money
 * @param amount - Amount to cover in cents; omit to cover the full overspending
 */
export async function coverOverspending(
  month: string,
  toCategoryId: string,
  fromCategoryId: string,
  amount?: number
): Promise<void> {
  const send = await getInternalSend();
  return send('budget/cover-overspending', {
    month,
    to: toCategoryId,
    from: fromCategoryId,
    amount,
    currencyCode: await getDefaultCurrencyCode(),
  });
}

/**
 * Read the budget's default currency code preference ('' when unset), which Actual
 * uses to format amounts in budget movement notes.
 */
export async function getDefaultCurrencyCode(): Promise<string> {
  await initActualApi();
  const result = await api.aqlQuery(api.q('preferences').filter({ id: 'defaultCurrencyCode' }).select(['value']));
  if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
    const value: unknown = result.data[0]?.value;
    if (typeof value === 'string') return value;
  }
  return '';
}
