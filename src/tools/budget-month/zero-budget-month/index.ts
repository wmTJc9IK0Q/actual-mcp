// ----------------------------
// ZERO BUDGET MONTH TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { zeroBudgetMonth } from '../../../api/budget-month.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { loadMonthBudget } from '../../budget-amounts/shared.js';
import { describeBudgetedChanges } from '../shared.js';

const ZeroBudgetMonthArgsSchema = z.object({
  month: OptionalMonthSchema,
});

type ZeroBudgetMonthArgs = z.infer<typeof ZeroBudgetMonthArgsSchema>;

export const schema = {
  name: 'zero-budget-month',
  description:
    "Set every category's budgeted amount in a month to zero, including hidden categories " +
    '(income categories are left alone for envelope budgets). Works for envelope and tracking budgets. ' +
    'Defaults to the current month.',
  inputSchema: toJSONSchema(ZeroBudgetMonthArgsSchema) as ToolInput,
};

export async function handler(args: ZeroBudgetMonthArgs): Promise<CallToolResult> {
  try {
    const { month = getCurrentMonth() } = ZeroBudgetMonthArgsSchema.parse(args);
    const before = await loadMonthBudget(month);
    await zeroBudgetMonth(month);
    const after = await loadMonthBudget(month);
    return success(`Set all budgeted amounts in ${month} to zero.\n` + describeBudgetedChanges(before, after));
  } catch (err) {
    return errorFromCatch(err);
  }
}
