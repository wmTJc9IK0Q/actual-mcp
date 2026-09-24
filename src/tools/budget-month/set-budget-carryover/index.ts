// ----------------------------
// SET BUDGET CARRYOVER TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { getBudgetMonth } from '../../../actual-api.js';
import { setBudgetCarryover } from '../../../api/budget-month.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';

const SetBudgetCarryoverArgsSchema = z.object({
  categoryId: z.string().min(1).describe('ID of the expense category to update'),
  enabled: z.boolean().describe('true to turn rollover on, false to turn it off'),
  month: OptionalMonthSchema.describe(
    'First budget month (YYYY-MM) to apply the setting to; every later month is updated too. Defaults to the current month.'
  ),
});

type SetBudgetCarryoverArgs = z.infer<typeof SetBudgetCarryoverArgsSchema>;

interface CategoryRollover {
  name: string;
  rollover: boolean;
}

/**
 * Read an expense category's name and rollover flag for a month.
 *
 * @param month - Month in YYYY-MM format
 * @param categoryId - Category ID to find
 * @returns The category's name and whether rollover is on
 * @throws If the category does not exist or is an income category
 */
async function loadCategoryRollover(month: string, categoryId: string): Promise<CategoryRollover> {
  const data = await getBudgetMonth(month);
  for (const group of data.categoryGroups) {
    for (const category of group.categories ?? []) {
      if (category.id !== categoryId) continue;
      const name = typeof category.name === 'string' ? category.name : categoryId;
      if (category.is_income === true || group.is_income === true) {
        throw new Error(`categoryId: "${name}" is an income category; rollover applies to expense categories`);
      }
      return { name, rollover: category.carryover === true };
    }
  }
  throw new Error(`categoryId: category "${categoryId}" not found in the ${month} budget`);
}

export const schema = {
  name: 'set-budget-carryover',
  description:
    "Turn a category's rollover on or off starting at a month and for every later month. " +
    'Envelope budgets: positive balances always roll over; with rollover on, a negative balance also rolls over ' +
    "into the category's next month instead of being taken from next month's To Budget. " +
    'Tracking budgets: with rollover on, the leftover balance (positive or negative) carries into next month; ' +
    'with it off, each month starts fresh. Defaults to the current month.',
  inputSchema: toJSONSchema(SetBudgetCarryoverArgsSchema) as ToolInput,
};

export async function handler(args: SetBudgetCarryoverArgs): Promise<CallToolResult> {
  try {
    const { categoryId, enabled, month = getCurrentMonth() } = SetBudgetCarryoverArgsSchema.parse(args);
    const before = await loadCategoryRollover(month, categoryId);
    await setBudgetCarryover(month, categoryId, enabled);
    const after = await loadCategoryRollover(month, categoryId);
    const label = (on: boolean): string => (on ? 'on' : 'off');
    return success(
      `Turned rollover ${label(enabled)} for ${after.name} from ${month} onward.\n` +
        `- Rollover in ${month}: ${label(before.rollover)} → ${label(after.rollover)}`
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
