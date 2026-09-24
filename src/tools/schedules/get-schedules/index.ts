// ----------------------------
// GET SCHEDULES TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { getSchedules } from '../../../api/schedules.js';
import type { ToolInput } from '../../../types.js';
import { formatSchedule, loadNames } from '../shared.js';

const GetSchedulesArgsSchema = z.object({
  includeCompleted: z
    .boolean()
    .optional()
    .describe('Include completed schedules (one-time schedules already paid, ended recurrences). Default true.'),
});

type GetSchedulesArgs = z.infer<typeof GetSchedulesArgsSchema>;

export const schema = {
  name: 'get-schedules',
  description:
    'List scheduled (recurring or one-time) transactions with ID, name, next date, amount and operator, ' +
    'account, payee, recurrence, whether the transaction is posted automatically, and completion. ' +
    'Amounts are shown in currency; negative = payment.',
  inputSchema: toJSONSchema(GetSchedulesArgsSchema) as ToolInput,
};

export async function handler(args: GetSchedulesArgs): Promise<CallToolResult> {
  try {
    const { includeCompleted = true } = GetSchedulesArgsSchema.parse(args);
    const all = await getSchedules();
    const schedules = includeCompleted ? all : all.filter((s) => !s.completed);
    if (schedules.length === 0) {
      return success(includeCompleted || all.length === 0 ? 'No schedules found.' : 'No active schedules found.');
    }
    const names = await loadNames();
    return success(
      `Found ${schedules.length} schedule(s):\n\n` + schedules.map((s) => formatSchedule(s, names)).join('\n\n')
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
