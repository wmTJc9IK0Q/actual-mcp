// ----------------------------
// COPY PREVIOUS MONTH BUDGET TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { copyPreviousMonth, copyPreviousMonthForCategory, getBudgetType } from '../../../api/budget-month.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { describeChanges, loadMonthBudget } from '../../budget-amounts/shared.js';
import { describeBudgetedChanges, previousMonth, requireBudgetableCategory } from '../shared.js';

const CopyPreviousMonthBudgetArgsSchema = z.object({
  categoryId: z
    .string()
    .min(1)
    .optional()
    .describe("ID of a single category to copy. Omit to copy every category's budgeted amount."),
  month: OptionalMonthSchema,
});

type CopyPreviousMonthBudgetArgs = z.infer<typeof CopyPreviousMonthBudgetArgsSchema>;

export const schema = {
  name: 'copy-previous-month-budget',
  description:
    "Copy the previous month's budgeted amounts into a month, replacing the month's current budgeted amounts. " +
    'Pass categoryId to copy one category; otherwise every visible category with a budget last month is copied ' +
    '(income categories are skipped for envelope budgets). Works for envelope and tracking budgets. ' +
    'Defaults to the current month.',
  inputSchema: toJSONSchema(CopyPreviousMonthBudgetArgsSchema) as ToolInput,
};

export async function handler(args: CopyPreviousMonthBudgetArgs): Promise<CallToolResult> {
  try {
    const { categoryId, month = getCurrentMonth() } = CopyPreviousMonthBudgetArgsSchema.parse(args);
    const fromMonth = previousMonth(month);
    const before = await loadMonthBudget(month);
    const previous = await loadMonthBudget(fromMonth);

    if (categoryId !== undefined) {
      const category = requireBudgetableCategory(before, categoryId, await getBudgetType());
      const copied = previous.categories.get(categoryId)?.budgeted ?? 0;
      await copyPreviousMonthForCategory(month, categoryId);
      const after = await loadMonthBudget(month);
      return success(
        `Copied ${category.name}'s ${fromMonth} budget of ${formatAmount(copied)} into ${month}.\n` +
          describeChanges(before, after, [categoryId])
      );
    }

    // Reason: copying an empty month would overwrite this month's budget with zeros.
    if (![...previous.categories.values()].some((category) => category.budgeted !== 0)) {
      throw new Error(`Nothing is budgeted in ${fromMonth}, so there is nothing to copy into ${month}`);
    }

    await copyPreviousMonth(month);
    const after = await loadMonthBudget(month);
    return success(`Copied ${fromMonth} budgeted amounts into ${month}.\n` + describeBudgetedChanges(before, after));
  } catch (err) {
    return errorFromCatch(err);
  }
}
