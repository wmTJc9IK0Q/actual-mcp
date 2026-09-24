// ----------------------------
// CLEANUP BUDGET TEMPLATES TOOL
// ----------------------------

import { toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { formatAmount } from '../../../utils.js';
import { cleanupBudgetTemplates } from '../../../api/budget-templates.js';
import type { ToolInput } from '../../../types.js';
import { describeChanges, loadMonthBudget } from '../../budget-amounts/shared.js';
import {
  BudgetTemplatesArgsSchema,
  formatTemplateResult,
  parseMonth,
  toToolResult,
  type BudgetTemplatesArgs,
} from '../shared.js';

export const schema = {
  name: 'cleanup-budget-templates',
  description:
    'Run Actual\'s "End of month cleanup" for a month (envelope budgeting), driven by "#cleanup" lines in ' +
    'category notes. In order: (1) group cleanups: "#cleanup <Group> source" categories return their leftover ' +
    'balance and it is shared among "#cleanup <Group> sink [weight]" categories, after first covering ' +
    'overspending in "#cleanup <Group>" categories (only when the group has sinks or overspend members); ' +
    '(2) "#cleanup source" categories return their positive leftover balance to "To Budget" (their budget is ' +
    'reduced by the balance); (3) every overspent expense category without rollover is covered from "To Budget", ' +
    'fully or partially; (4) all remaining "To Budget" money is split among "#cleanup sink [weight]" categories in ' +
    'proportion to their weights (default 1). Refuses to run while "To Budget" is negative, because Actual would ' +
    "push the shortfall into overspent or sink categories' budgets, making them negative. " +
    'Changes budgeted amounts for the month and reports every category that changed. Defaults to the current month.',
  inputSchema: toJSONSchema(BudgetTemplatesArgsSchema) as ToolInput,
};

export async function handler(args: BudgetTemplatesArgs): Promise<CallToolResult> {
  try {
    const month = parseMonth(args);
    const before = await loadMonthBudget(month);
    // Reason: with a negative "To Budget", Actual's cleanup budgets the deficit (a negative amount)
    // into overspent categories or sinks instead of stopping.
    if (before.toBudget < 0) {
      throw new Error(
        `"To Budget" for ${month} is ${formatAmount(before.toBudget)}; cover the overbudgeting (reduce budgeted ` +
          'amounts) before running end-of-month cleanup. Nothing was changed.'
      );
    }
    const result = await cleanupBudgetTemplates(month);
    // Reason: cleanup reports warnings (e.g. a source with no funds) in `pre` alongside a partial
    // success, so only a real error notification is treated as a failure.
    if (result.type === 'error') return toToolResult(month, result);

    const after = await loadMonthBudget(month);
    const changedIds = [...after.categories.values()]
      .filter((category) => before.categories.get(category.id)?.budgeted !== category.budgeted)
      .map((category) => category.id);
    const changes = changedIds.length > 0 ? describeChanges(before, after, changedIds) : 'No budgeted amounts changed.';
    return success(`End-of-month cleanup for ${month}: ${formatTemplateResult(result)}\n${changes}`);
  } catch (err) {
    return errorFromCatch(err);
  }
}
