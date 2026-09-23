// ----------------------------
// COVER OVERSPENDING TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { coverOverspending } from '../../../actual-api.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { PositiveAmountSchema, describeChanges, loadMonthBudget, requireExpenseCategory } from '../shared.js';

const CoverOverspendingArgsSchema = z.object({
  categoryId: z.string().min(1).describe('ID of the overspent category (negative balance) to cover'),
  fromCategoryId: z.string().min(1).describe('ID of the category whose available balance covers the overspending'),
  amount: PositiveAmountSchema.optional().describe(
    'Amount to cover in cents. Omit to cover the full overspending. For example, $120.30 is 12030.'
  ),
  month: OptionalMonthSchema,
});

type CoverOverspendingArgs = z.infer<typeof CoverOverspendingArgsSchema>;

export const schema = {
  name: 'cover-overspending',
  description:
    "Cover an overspent category's negative balance for a month using another category's available balance. " +
    'Covers the full overspending unless amount is given; if the source has less available, only that much is covered. ' +
    'Defaults to the current month.',
  inputSchema: toJSONSchema(CoverOverspendingArgsSchema) as ToolInput,
};

export async function handler(args: CoverOverspendingArgs): Promise<CallToolResult> {
  try {
    const { categoryId, fromCategoryId, amount, month = getCurrentMonth() } = CoverOverspendingArgsSchema.parse(args);
    if (categoryId === fromCategoryId) {
      throw new Error('categoryId and fromCategoryId must be different categories');
    }
    const before = await loadMonthBudget(month);
    const target = requireExpenseCategory(before, categoryId);
    const source = requireExpenseCategory(before, fromCategoryId, 'fromCategoryId');

    // Reason: Actual's cover handler silently does nothing in these cases, so report them explicitly.
    const overspent = -target.balance;
    if (overspent <= 0) {
      throw new Error(`${target.name} is not overspent in ${month} (balance ${formatAmount(target.balance)})`);
    }
    if (source.balance <= 0) {
      throw new Error(`${source.name} has no available balance in ${month} (balance ${formatAmount(source.balance)})`);
    }
    if (amount !== undefined && amount > overspent) {
      throw new Error(
        `amount ${formatAmount(amount)} exceeds ${target.name}'s overspending of ${formatAmount(overspent)}; ` +
          'use transfer-budget-amount to move more'
      );
    }

    await coverOverspending(month, categoryId, fromCategoryId, amount);

    const covered = Math.min(amount ?? overspent, source.balance);
    const after = await loadMonthBudget(month);
    return success(
      `Covered ${formatAmount(covered)} of ${target.name}'s ${formatAmount(overspent)} overspending ` +
        `from ${source.name} for ${month}.\n` +
        describeChanges(before, after, [categoryId, fromCategoryId])
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
