// ----------------------------
// COVER OVERBUDGETED TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { coverOverbudgeted } from '../../../api/budget-month.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import {
  PositiveAmountSchema,
  describeChanges,
  loadMonthBudget,
  requireExpenseCategory,
} from '../../budget-amounts/shared.js';
import { requireEnvelopeBudget } from '../shared.js';

const CoverOverbudgetedArgsSchema = z.object({
  fromCategoryId: z
    .string()
    .min(1)
    .describe('ID of the category whose available balance is returned to To Budget to cover the shortfall'),
  amount: PositiveAmountSchema.optional().describe(
    'Amount to cover in cents. Omit to cover the full negative To Budget. For example, $120.30 is 12030.'
  ),
  month: OptionalMonthSchema,
});

type CoverOverbudgetedArgs = z.infer<typeof CoverOverbudgetedArgsSchema>;

export const schema = {
  name: 'cover-overbudgeted',
  description:
    "When a month is over-budgeted (To Budget is negative), cover the shortfall by reducing a category's budgeted " +
    'amount by up to its available balance. Covers the full shortfall unless amount is given; if the category has ' +
    'less available, only that much is covered. Envelope budgets only. Defaults to the current month.',
  inputSchema: toJSONSchema(CoverOverbudgetedArgsSchema) as ToolInput,
};

export async function handler(args: CoverOverbudgetedArgs): Promise<CallToolResult> {
  try {
    const { fromCategoryId, amount, month = getCurrentMonth() } = CoverOverbudgetedArgsSchema.parse(args);
    await requireEnvelopeBudget('Covering an over-budgeted month');
    const before = await loadMonthBudget(month);
    const source = requireExpenseCategory(before, fromCategoryId, 'fromCategoryId');

    // Reason: Actual's cover handler silently does nothing in these cases, and with an explicit
    // amount it moves money even when the month is not over-budgeted, so validate up front.
    const overbudgeted = -before.toBudget;
    if (overbudgeted <= 0) {
      throw new Error(`${month} is not over-budgeted (To Budget ${formatAmount(before.toBudget)})`);
    }
    if (source.balance <= 0) {
      throw new Error(`${source.name} has no available balance in ${month} (balance ${formatAmount(source.balance)})`);
    }
    if (amount !== undefined && amount > overbudgeted) {
      throw new Error(
        `amount ${formatAmount(amount)} exceeds the ${formatAmount(overbudgeted)} over-budgeted in ${month}; ` +
          'use subtract-budget-amount to move more back to To Budget'
      );
    }

    await coverOverbudgeted(month, fromCategoryId, amount);

    const covered = Math.min(amount ?? overbudgeted, source.balance);
    const after = await loadMonthBudget(month);
    return success(
      `Covered ${formatAmount(covered)} of the ${formatAmount(overbudgeted)} over-budgeted in ${month} ` +
        `from ${source.name}.\n` +
        describeChanges(before, after, [fromCategoryId])
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
