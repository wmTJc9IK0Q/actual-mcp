// ----------------------------
// GET MONTHLY BUDGETS TOOL
// ----------------------------

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { toJSONSchema } from 'zod';
import { MonthlyBudgetsInputParser } from './input-parser.js';
import { MonthlyBudgetsDataFetcher } from './data-fetcher.js';
import { MonthlyBudgetsReportGenerator } from './report-generator.js';
import { success, errorFromCatch } from '../../utils/response.js';
import { MonthlyBudgetsArgsSchema, type MonthlyBudgetsArgs, ToolInput } from '../../types.js';

export const schema = {
  name: 'get-monthly-budgets',
  description:
    'Get the budgeted amount, spent amount, and current balance for every budget category, ' +
    'grouped by category group, for each month in a range (YYYY-MM). Defaults to the current month.',
  inputSchema: toJSONSchema(MonthlyBudgetsArgsSchema) as ToolInput,
};

export async function handler(args: MonthlyBudgetsArgs): Promise<CallToolResult> {
  try {
    const input = new MonthlyBudgetsInputParser().parse(args);
    const months = await new MonthlyBudgetsDataFetcher().fetchAll(input.startMonth, input.endMonth);
    const markdown = new MonthlyBudgetsReportGenerator().generate(months, {
      start: input.startMonth,
      end: input.endMonth,
    });
    return success(markdown);
  } catch (err) {
    return errorFromCatch(err);
  }
}
