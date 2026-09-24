// ----------------------------
// CHECK BUDGET TEMPLATES TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { checkBudgetTemplates } from '../../../api/budget-templates.js';
import type { ToolInput } from '../../../types.js';

const CheckBudgetTemplatesArgsSchema = z.object({});

export const schema = {
  name: 'check-budget-templates',
  description:
    'Check every category note\'s "#template" and "#goal" lines for syntax errors and references to ' +
    'schedules that do not exist (Actual\'s "Check templates"). Read-only: nothing is budgeted or stored. ' +
    'Reports each failing line as "Category: line", or confirms all templates are valid. ' +
    'Templates edited in Actual\'s template UI and "#cleanup" lines are not checked.',
  inputSchema: toJSONSchema(CheckBudgetTemplatesArgsSchema) as ToolInput,
};

export async function handler(): Promise<CallToolResult> {
  try {
    const result = await checkBudgetTemplates();
    // Reason: finding template errors is this tool's successful outcome, so they are reported
    // as a normal result rather than a tool error.
    if (result.pre) {
      return success(`Found budget template errors:\n\n${result.pre}`);
    }
    return success('All budget templates are valid.');
  } catch (err) {
    return errorFromCatch(err);
  }
}
