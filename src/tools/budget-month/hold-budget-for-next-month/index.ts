// ----------------------------
// HOLD BUDGET FOR NEXT MONTH TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { holdBudgetForNextMonth } from '../../../api/budget-month.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { PositiveAmountSchema } from '../../budget-amounts/shared.js';
import { describeHoldChanges, loadHoldState, requireEnvelopeBudget } from '../shared.js';

const HoldBudgetForNextMonthArgsSchema = z.object({
  amount: PositiveAmountSchema.describe(
    'Amount of To Budget to hold for next month, in cents. Added to any amount already held. For example, $120.30 is 12030.'
  ),
  month: OptionalMonthSchema,
});

type HoldBudgetForNextMonthArgs = z.infer<typeof HoldBudgetForNextMonthArgsSchema>;

export const schema = {
  name: 'hold-budget-for-next-month',
  description:
    "Hold part of a month's To Budget for next month, so it becomes available to budget next month instead. " +
    'The amount is added to anything already held and cannot exceed the available To Budget. ' +
    'Envelope budgets only. Use reset-budget-hold to release held money. Defaults to the current month.',
  inputSchema: toJSONSchema(HoldBudgetForNextMonthArgsSchema) as ToolInput,
};

export async function handler(args: HoldBudgetForNextMonthArgs): Promise<CallToolResult> {
  try {
    const { amount, month = getCurrentMonth() } = HoldBudgetForNextMonthArgsSchema.parse(args);
    await requireEnvelopeBudget('Holding money for next month');
    const before = await loadHoldState(month);

    // Reason: Actual returns false when To Budget is not positive and silently clamps larger amounts.
    if (before.toBudget <= 0) {
      throw new Error(`No money is available to hold: To Budget for ${month} is ${formatAmount(before.toBudget)}`);
    }
    if (amount > before.toBudget) {
      throw new Error(
        `amount ${formatAmount(amount)} exceeds the ${formatAmount(before.toBudget)} available in To Budget for ${month}`
      );
    }

    if (!(await holdBudgetForNextMonth(month, amount))) {
      throw new Error(`Actual did not hold any money for ${month}`);
    }
    const after = await loadHoldState(month);
    return success(
      `Held ${formatAmount(amount)} of ${month}'s To Budget for next month.\n` + describeHoldChanges(before, after)
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
