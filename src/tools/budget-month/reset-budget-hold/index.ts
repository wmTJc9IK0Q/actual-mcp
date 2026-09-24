// ----------------------------
// RESET BUDGET HOLD TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { resetBudgetHold } from '../../../api/budget-month.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { formatAmount, getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { describeHoldChanges, loadHoldState, requireEnvelopeBudget } from '../shared.js';

const ResetBudgetHoldArgsSchema = z.object({
  month: OptionalMonthSchema,
});

type ResetBudgetHoldArgs = z.infer<typeof ResetBudgetHoldArgsSchema>;

export const schema = {
  name: 'reset-budget-hold',
  description:
    "Release all money held for next month back into the month's To Budget (undoes hold-budget-for-next-month). " +
    'Envelope budgets only. Defaults to the current month.',
  inputSchema: toJSONSchema(ResetBudgetHoldArgsSchema) as ToolInput,
};

export async function handler(args: ResetBudgetHoldArgs): Promise<CallToolResult> {
  try {
    const { month = getCurrentMonth() } = ResetBudgetHoldArgsSchema.parse(args);
    await requireEnvelopeBudget('Releasing held money');
    const before = await loadHoldState(month);
    if (before.held === 0) {
      throw new Error(`No money is held for next month in ${month}`);
    }

    await resetBudgetHold(month);
    const after = await loadHoldState(month);
    return success(
      `Released ${formatAmount(before.held)} held for next month back into ${month}'s To Budget.\n` +
        describeHoldChanges(before, after)
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
