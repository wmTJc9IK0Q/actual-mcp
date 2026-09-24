// ----------------------------
// OVERWRITE BUDGET TEMPLATES TOOL
// ----------------------------

import { toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { errorFromCatch } from '../../../utils/response.js';
import { checkBudgetTemplates, overwriteBudgetTemplates } from '../../../api/budget-templates.js';
import type { ToolInput } from '../../../types.js';
import { BudgetTemplatesArgsSchema, parseMonth, toToolResult, type BudgetTemplatesArgs } from '../shared.js';

export const schema = {
  name: 'overwrite-budget-templates',
  description:
    'Run the budget templates (from category notes/goals) for every category in a month, ' +
    'replacing any existing budgeted amounts for categories that have templates. ' +
    'Use apply-budget-templates to only fill unbudgeted categories. Fails without changing anything if any ' +
    'template has a syntax error (see check-budget-templates). Defaults to the current month.',
  inputSchema: toJSONSchema(BudgetTemplatesArgsSchema) as ToolInput,
};

export async function handler(args: BudgetTemplatesArgs): Promise<CallToolResult> {
  try {
    const month = parseMonth(args);
    // Reason: Actual skips unparseable template lines and, because overwrite forces every category,
    // resets a category whose only template is broken to 0 while still reporting success.
    const { pre: templateErrors } = await checkBudgetTemplates();
    if (templateErrors) {
      throw new Error(
        `Fix these budget template errors before overwriting (nothing was changed):\n\n${templateErrors}`
      );
    }
    return toToolResult(month, await overwriteBudgetTemplates(month));
  } catch (err) {
    return errorFromCatch(err);
  }
}
