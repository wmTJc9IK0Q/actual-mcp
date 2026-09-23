// ----------------------------
// SUBTRACT BUDGET AMOUNT TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { TO_BUDGET, transferBudgetAmount } from '../../../actual-api.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { PositiveAmountSchema, describeChanges, loadMonthBudget, requireExpenseCategory } from '../shared.js';

const SubtractBudgetAmountArgsSchema = z.object({
  categoryId: z.string().min(1).describe('ID of the category giving up the money'),
  amount: PositiveAmountSchema,
  month: OptionalMonthSchema,
});

type SubtractBudgetAmountArgs = z.infer<typeof SubtractBudgetAmountArgsSchema>;

export const schema = {
  name: 'subtract-budget-amount',
  description:
    'Remove money from a category\'s budget for a month and return it to "To Budget". ' +
    "Fails if the amount exceeds the category's available balance. Defaults to the current month.",
  inputSchema: toJSONSchema(SubtractBudgetAmountArgsSchema) as ToolInput,
};

export async function handler(args: SubtractBudgetAmountArgs): Promise<CallToolResult> {
  try {
    const { categoryId, amount, month = getCurrentMonth() } = SubtractBudgetAmountArgsSchema.parse(args);
    const before = await loadMonthBudget(month);
    const category = requireExpenseCategory(before, categoryId);
    if (amount > category.balance) {
      throw new Error(
        `Cannot subtract ${formatAmount(amount)}: ${category.name} only has ${formatAmount(category.balance)} available in ${month}`
      );
    }

    await transferBudgetAmount(month, amount, categoryId, TO_BUDGET);

    const after = await loadMonthBudget(month);
    return success(
      `Moved ${formatAmount(amount)} from ${category.name} back to To Budget for ${month}.\n` +
        describeChanges(before, after, [categoryId])
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
