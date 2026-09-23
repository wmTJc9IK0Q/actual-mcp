// ----------------------------
// TRANSFER BUDGET AMOUNT TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { transferBudgetAmount } from '../../../actual-api.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { PositiveAmountSchema, describeChanges, loadMonthBudget, requireExpenseCategory } from '../shared.js';

const TransferBudgetAmountArgsSchema = z.object({
  fromCategoryId: z.string().min(1).describe('ID of the category giving up the money'),
  toCategoryId: z.string().min(1).describe('ID of the category receiving the money'),
  amount: PositiveAmountSchema,
  month: OptionalMonthSchema,
});

type TransferBudgetAmountArgs = z.infer<typeof TransferBudgetAmountArgsSchema>;

export const schema = {
  name: 'transfer-budget-amount',
  description:
    'Move budgeted money from one category to another for a month. "To Budget" is unchanged. ' +
    "Fails if the amount exceeds the source category's available balance. Defaults to the current month.",
  inputSchema: toJSONSchema(TransferBudgetAmountArgsSchema) as ToolInput,
};

export async function handler(args: TransferBudgetAmountArgs): Promise<CallToolResult> {
  try {
    const {
      fromCategoryId,
      toCategoryId,
      amount,
      month = getCurrentMonth(),
    } = TransferBudgetAmountArgsSchema.parse(args);
    if (fromCategoryId === toCategoryId) {
      throw new Error('fromCategoryId and toCategoryId must be different categories');
    }
    const before = await loadMonthBudget(month);
    const from = requireExpenseCategory(before, fromCategoryId, 'fromCategoryId');
    const to = requireExpenseCategory(before, toCategoryId, 'toCategoryId');
    if (amount > from.balance) {
      throw new Error(
        `Cannot transfer ${formatAmount(amount)}: ${from.name} only has ${formatAmount(from.balance)} available in ${month}`
      );
    }

    await transferBudgetAmount(month, amount, fromCategoryId, toCategoryId);

    const after = await loadMonthBudget(month);
    return success(
      `Transferred ${formatAmount(amount)} from ${from.name} to ${to.name} for ${month}.\n` +
        describeChanges(before, after, [fromCategoryId, toCategoryId])
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
