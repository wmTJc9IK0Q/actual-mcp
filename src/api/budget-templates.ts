// ----------------------------
// ACTUAL API - BUDGET TEMPLATES
// ----------------------------

import { getInternalSend } from '../actual-api.js';

/**
 * Result notification returned by Actual's budget template handlers.
 * Since Actual 26.9, `message` is a translation key (e.g. `templates-applied`) with the numbers
 * in `count`/`sourceCount`/`sinkCount`; `pre` carries template errors or cleanup warnings.
 */
export interface BudgetTemplateResult {
  type?: 'message' | 'error' | 'warning';
  pre?: string;
  title?: string;
  message: string;
  sticky?: boolean;
  /** Categories the templates were applied to (`templates-applied`). */
  count?: number;
  /** Cleanup source categories that returned funds (`cleanup-applied*`). */
  sourceCount?: number;
  /** Cleanup sink categories that were funded (`cleanup-applied*`). */
  sinkCount?: number;
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

/**
 * Check every category's `#template`/`#goal` note lines for syntax errors and
 * references to missing schedules (matches Actual's "Check templates").
 * Reason: Actual registers this handler as a mutator, but it only reads notes and
 * schedules; nothing is stored.
 *
 * @returns Actual's result notification; `pre` lists the failing lines
 */
export async function checkBudgetTemplates(): Promise<BudgetTemplateResult> {
  const send = await getInternalSend();
  return send('budget/check-templates');
}

/**
 * Apply budget templates for specific categories in a month, replacing their existing
 * budgeted amounts (Actual always forces overwrite for this handler).
 *
 * @param month - Month in YYYY-MM format
 * @param categoryIds - Categories whose templates should run
 * @returns Actual's result notification
 */
export async function applyCategoryBudgetTemplates(
  month: string,
  categoryIds: string[]
): Promise<BudgetTemplateResult> {
  const send = await getInternalSend();
  return send('budget/apply-multiple-templates', { month, categoryIds });
}

/**
 * Run end-of-month cleanup (`#cleanup` note templates) for a month, matching Actual's
 * "End of month cleanup": sources return leftover funds, overspending is covered, and
 * sinks receive the remainder.
 *
 * @param month - Month in YYYY-MM format
 * @returns Actual's result notification
 */
export async function cleanupBudgetTemplates(month: string): Promise<BudgetTemplateResult> {
  const send = await getInternalSend();
  return send('budget/cleanup-goal-template', { month });
}
