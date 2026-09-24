// ----------------------------
// DELETE SCHEDULE TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { deleteSchedule, getSchedules } from '../../../api/schedules.js';
import type { ToolInput } from '../../../types.js';
import { requireSchedule, scheduleLabel } from '../shared.js';

const DeleteScheduleArgsSchema = z.object({
  id: z.string().min(1).describe('ID of the schedule to delete'),
});

type DeleteScheduleArgs = z.infer<typeof DeleteScheduleArgsSchema>;

export const schema = {
  name: 'delete-schedule',
  description: 'Delete a schedule and its underlying rule. Transactions already created from it are kept.',
  inputSchema: toJSONSchema(DeleteScheduleArgsSchema) as ToolInput,
};

export async function handler(args: DeleteScheduleArgs): Promise<CallToolResult> {
  try {
    const { id } = DeleteScheduleArgsSchema.parse(args);
    // Reason: Actual silently succeeds for unknown IDs.
    const schedule = requireSchedule(await getSchedules(), id);
    await deleteSchedule(id);
    return success(`Deleted schedule ${scheduleLabel(schedule)} (id: ${id}).`);
  } catch (err) {
    return errorFromCatch(err);
  }
}
