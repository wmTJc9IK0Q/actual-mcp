// ----------------------------
// UPDATE SCHEDULE TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { APIScheduleEntity } from '@actual-app/core/server/api-models';
import { success, errorFromCatch } from '../../../utils/response.js';
import { getSchedules, updateSchedule } from '../../../api/schedules.js';
import type { ToolInput } from '../../../types.js';
import {
  AmountOpSchema,
  ScheduleAmountValueSchema,
  ScheduleDateSchema,
  formatSchedule,
  loadNames,
  normalizeScheduleDate,
  requireSchedule,
  toScheduleAmount,
} from '../shared.js';

const UpdateScheduleArgsSchema = z.object({
  id: z.string().min(1).describe('ID of the schedule to update'),
  name: z.string().trim().min(1).optional().describe('New unique name'),
  date: ScheduleDateSchema.optional().describe(
    'New one-time date (YYYY-MM-DD) or recurrence config; replaces the whole date, so send every recurrence field'
  ),
  amount: ScheduleAmountValueSchema.optional(),
  amountOp: AmountOpSchema.optional().describe(
    'New amount operator. Switching to or from "isbetween" requires a matching amount in the same call.'
  ),
  accountId: z.string().min(1).optional().describe('New account ID'),
  payeeId: z.string().min(1).optional().describe('New payee ID'),
  postsTransaction: z.boolean().optional().describe('Automatically add the transaction on its date'),
  resetNextDate: z
    .boolean()
    .optional()
    .describe(
      'Recompute the next date from today. Happens automatically when date or account change; ' +
        "may be sent alone to re-sync a schedule's next date."
    ),
});

type UpdateScheduleArgs = z.infer<typeof UpdateScheduleArgsSchema>;

export const schema = {
  name: 'update-schedule',
  description:
    'Update a schedule. Only the given fields change. Amount is in cents: negative = payment, positive = deposit. ' +
    'Returns the schedule after the update.',
  inputSchema: toJSONSchema(UpdateScheduleArgsSchema) as ToolInput,
};

export async function handler(args: UpdateScheduleArgs): Promise<CallToolResult> {
  try {
    const { id, name, date, amount, amountOp, accountId, payeeId, postsTransaction, resetNextDate } =
      UpdateScheduleArgsSchema.parse(args);
    const current = requireSchedule(await getSchedules(), id);

    // Reason: Actual applies every key present (even undefined ones, e.g. name becomes "undefined"),
    // so only set the fields the caller supplied.
    const fields: Partial<APIScheduleEntity> = {};
    if (name !== undefined) fields.name = name;
    if (date !== undefined) fields.date = normalizeScheduleDate(date);
    if (accountId !== undefined) fields.account = accountId;
    if (payeeId !== undefined) fields.payee = payeeId;
    if (postsTransaction !== undefined) fields.posts_transaction = postsTransaction;
    if (amount !== undefined || amountOp !== undefined) {
      // Reason: Actual saves a mismatched operator/amount pair as a broken rule without erroring.
      const next = toScheduleAmount(amountOp ?? current.amountOp, amount ?? current.amount ?? 0);
      fields.amountOp = next.op;
      fields.amount = next.value;
    }
    if (Object.keys(fields).length === 0 && !resetNextDate) {
      throw new Error('Nothing to update: provide at least one field to change, or resetNextDate');
    }
    if ((postsTransaction ?? current.posts_transaction) && !(accountId ?? current.account)) {
      throw new Error('postsTransaction requires an account: Actual cannot add a transaction without one');
    }
    const names = await loadNames({ accountId, payeeId });

    await updateSchedule(id, fields, resetNextDate);

    const updated = requireSchedule(await getSchedules(), id);
    return success(`Updated schedule:\n${formatSchedule(updated, names)}`);
  } catch (err) {
    return errorFromCatch(err);
  }
}
