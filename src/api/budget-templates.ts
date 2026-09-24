// ----------------------------
// ACTUAL API - BUDGET TEMPLATES
// ----------------------------

import { getInternalSend } from '../actual-api.js';

/**
 * Result notification returned by Actual's budget template handlers.
 * `pre` carries template parse errors (one block per failing category).
 */
export interface BudgetTemplateResult {
  type?: 'message' | 'error' | 'warning';
  pre?: string;
  title?: string;
  message: string;
  sticky?: boolean;
}

/**
 * Apply budget templates for every category in a month, only filling categories
 * that have no budgeted amount yet (matches Actual's "Apply budget template").
 *
 * @param month - Month in YYYY-MM format
 * @returns Actual's result notification
 */
export async function applyBudgetTemplates(month: string): Promise<BudgetTemplateResult> {
  const send = await getInternalSend();
  return send('budget/apply-goal-template', { month });
}

/**
 * Apply budget templates for every category in a month, replacing any existing
 * budgeted amounts (matches Actual's "Overwrite with budget template").
 *
 * @param month - Month in YYYY-MM format
 * @returns Actual's result notification
 */
export async function overwriteBudgetTemplates(month: string): Promise<BudgetTemplateResult> {
  const send = await getInternalSend();
  return send('budget/overwrite-goal-template', { month });
}
