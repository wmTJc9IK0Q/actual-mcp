// ----------------------------
// SET BUDGET TO AVERAGE TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import {
  getBudgetType,
  isAllCategoryAverageMonths,
  setAllBudgetsToAverage,
  setCategoryBudgetToAverage,
} from '../../../api/budget-month.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { describeChanges, loadMonthBudget } from '../../budget-amounts/shared.js';
import { describeBudgetedChanges, requireBudgetableCategory } from '../shared.js';

const SetBudgetToAverageArgsSchema = z.object({
  months: z
    .number()
    .int('months must be an integer')
    .min(1, 'months must be at least 1')
    .max(120, 'months must be at most 120')
    .describe('Number of previous months to average. Must be 3, 6, or 12 when categoryId is omitted.'),
  categoryId: z
    .string()
    .min(1)
    .optional()
    .describe('ID of a single category to set. Omit to set every visible category (months must then be 3, 6, or 12).'),
  month: OptionalMonthSchema,
});

type SetBudgetToAverageArgs = z.infer<typeof SetBudgetToAverageArgsSchema>;

export const schema = {
  name: 'set-budget-to-average',
  description:
    "Set a month's budgeted amounts to each category's average spending over the previous N months. " +
    'The average covers the N months before the target month (for the current or a future month, the N full months ' +
    "before the current month), skipping months before the category's first budget or transaction activity. " +
    'Pass categoryId to set one category over any N; omit it to set every visible category, which supports ' +
    'N of 3, 6, or 12 (income categories are included only for tracking budgets). Defaults to the current month.',
  inputSchema: toJSONSchema(SetBudgetToAverageArgsSchema) as ToolInput,
};

export async function handler(args: SetBudgetToAverageArgs): Promise<CallToolResult> {
  try {
    const { months, categoryId, month = getCurrentMonth() } = SetBudgetToAverageArgsSchema.parse(args);
    const before = await loadMonthBudget(month);

    if (categoryId !== undefined) {
      const category = requireBudgetableCategory(before, categoryId, await getBudgetType());
      await setCategoryBudgetToAverage(month, categoryId, months);
      const after = await loadMonthBudget(month);
      return success(
        `Set ${category.name}'s ${month} budget to its ${months}-month average of ` +
          `${formatAmount(after.categories.get(categoryId)?.budgeted)}.\n` +
          describeChanges(before, after, [categoryId])
      );
    }

    // Reason: Actual only has all-category averaging handlers for 3, 6 and 12 months.
    if (!isAllCategoryAverageMonths(months)) {
      throw new Error(
        `months must be 3, 6, or 12 to average every category (got ${months}); pass categoryId to average one category`
      );
    }
    await setAllBudgetsToAverage(month, months);
    const after = await loadMonthBudget(month);
    return success(
      `Set every visible category's ${month} budget to its ${months}-month average.\n` +
        describeBudgetedChanges(before, after)
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
