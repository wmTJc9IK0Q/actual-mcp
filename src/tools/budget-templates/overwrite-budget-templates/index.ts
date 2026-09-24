// ----------------------------
// OVERWRITE BUDGET TEMPLATES TOOL
// ----------------------------

import { toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { errorFromCatch } from '../../../utils/response.js';
import { overwriteBudgetTemplates } from '../../../api/budget-templates.js';
import type { ToolInput } from '../../../types.js';
import { BudgetTemplatesArgsSchema, parseMonth, toToolResult, type BudgetTemplatesArgs } from '../shared.js';

export const schema = {
  name: 'overwrite-budget-templates',
  description:
    'Run the budget templates (from category notes/goals) for every category in a month, ' +
    'replacing any existing budgeted amounts for categories that have templates. ' +
    'Use apply-budget-templates to only fill unbudgeted categories. Defaults to the current month.',
  inputSchema: toJSONSchema(BudgetTemplatesArgsSchema) as ToolInput,
};

export async function handler(args: BudgetTemplatesArgs): Promise<CallToolResult> {
  try {
    const month = parseMonth(args);
    return toToolResult(month, await overwriteBudgetTemplates(month));
  } catch (err) {
    return errorFromCatch(err);
  }
}
