// ----------------------------
// SET BUDGET AMOUNT TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { setBudgetAmount } from '../../../api/budget-amounts.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { describeChanges, loadMonthBudget } from '../shared.js';

const SetBudgetAmountArgsSchema = z.object({
  categoryId: z.string().min(1).describe('ID of the category to update'),
  amount: z
    .number()
    .int('amount must be an integer number of cents')
    .describe('New total budgeted amount in cents. For example, $120.30 is 12030.'),
  month: OptionalMonthSchema,
});

type SetBudgetAmountArgs = z.infer<typeof SetBudgetAmountArgsSchema>;

export const schema = {
  name: 'set-budget-amount',
  description:
    "Set a category's budgeted amount for a month to a new total. The difference is taken from or " +
    'returned to "To Budget". Defaults to the current month.',
  inputSchema: toJSONSchema(SetBudgetAmountArgsSchema) as ToolInput,
};

export async function handler(args: SetBudgetAmountArgs): Promise<CallToolResult> {
  try {
    const { categoryId, amount, month = getCurrentMonth() } = SetBudgetAmountArgsSchema.parse(args);
    const before = await loadMonthBudget(month);
    const category = before.categories.get(categoryId);
    if (!category) {
      throw new Error(`categoryId: category "${categoryId}" not found in the ${month} budget`);
    }

    await setBudgetAmount(month, categoryId, amount);

    const after = await loadMonthBudget(month);
    return success(
      `Set ${category.name} budget for ${month} to ${formatAmount(amount)}.\n` +
        describeChanges(before, after, [categoryId])
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
