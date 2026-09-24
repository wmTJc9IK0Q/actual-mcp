// ----------------------------
// ADD BUDGET AMOUNT TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { addBudgetFromToBudget } from '../../../api/budget-amounts.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { PositiveAmountSchema, describeChanges, loadMonthBudget, requireExpenseCategory } from '../shared.js';

const AddBudgetAmountArgsSchema = z.object({
  categoryId: z.string().min(1).describe('ID of the category receiving the money'),
  amount: PositiveAmountSchema,
  month: OptionalMonthSchema,
});

type AddBudgetAmountArgs = z.infer<typeof AddBudgetAmountArgsSchema>;

export const schema = {
  name: 'add-budget-amount',
  description:
    'Add money to a category\'s budget for a month, taking it from "To Budget". ' +
    'Fails if "To Budget" does not have enough available. Defaults to the current month.',
  inputSchema: toJSONSchema(AddBudgetAmountArgsSchema) as ToolInput,
};

export async function handler(args: AddBudgetAmountArgs): Promise<CallToolResult> {
  try {
    const { categoryId, amount, month = getCurrentMonth() } = AddBudgetAmountArgsSchema.parse(args);
    const before = await loadMonthBudget(month);
    const category = requireExpenseCategory(before, categoryId);
    // Reason: Actual silently clamps this transfer to the available "To Budget"; reject instead
    // so the caller never ends up with less than requested without noticing.
    if (amount > before.toBudget) {
      throw new Error(
        `Cannot add ${formatAmount(amount)}: only ${formatAmount(before.toBudget)} is available in To Budget for ${month}`
      );
    }

    await addBudgetFromToBudget(month, categoryId, amount);

    const after = await loadMonthBudget(month);
    return success(
      `Added ${formatAmount(amount)} from To Budget to ${category.name} for ${month}.\n` +
        describeChanges(before, after, [categoryId])
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
