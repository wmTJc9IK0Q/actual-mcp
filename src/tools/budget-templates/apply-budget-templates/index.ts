// ----------------------------
// APPLY BUDGET TEMPLATES TOOL
// ----------------------------

import { toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { errorFromCatch } from '../../../utils/response.js';
import { applyBudgetTemplates } from '../../../actual-api.js';
import type { ToolInput } from '../../../types.js';
import { BudgetTemplatesArgsSchema, parseMonth, toToolResult, type BudgetTemplatesArgs } from '../shared.js';

export const schema = {
  name: 'apply-budget-templates',
  description:
    'Run the budget templates (from category notes/goals) for every category in a month. ' +
    'Only categories with no budgeted amount yet are filled; existing budgeted amounts are kept. ' +
    'Use overwrite-budget-templates to replace existing amounts. Defaults to the current month.',
  inputSchema: toJSONSchema(BudgetTemplatesArgsSchema) as ToolInput,
};

export async function handler(args: BudgetTemplatesArgs): Promise<CallToolResult> {
  try {
    const month = parseMonth(args);
    return toToolResult(month, await applyBudgetTemplates(month));
  } catch (err) {
    return errorFromCatch(err);
  }
}
