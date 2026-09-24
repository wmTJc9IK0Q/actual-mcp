// ----------------------------
// CREATE SCHEDULE TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { createSchedule, getSchedules } from '../../../api/schedules.js';
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

const CreateScheduleArgsSchema = z.object({
  name: z.string().trim().min(1).optional().describe('Unique schedule name'),
  date: ScheduleDateSchema,
  amount: ScheduleAmountValueSchema,
  amountOp: AmountOpSchema.optional().describe(
    'Amount operator. Defaults to "isbetween" for a {num1, num2} amount, otherwise "isapprox" (Actual\'s default).'
  ),
  accountId: z.string().min(1).optional().describe('Account the transaction is in; omit to match any account'),
  payeeId: z.string().min(1).optional().describe('Payee ID; omit to match any payee'),
  postsTransaction: z
    .boolean()
    .optional()
    .describe('Automatically add the transaction on its date (default false). Requires an account.'),
});

type CreateScheduleArgs = z.infer<typeof CreateScheduleArgsSchema>;

export const schema = {
  name: 'create-schedule',
  description:
    'Create a scheduled transaction (one-time or recurring). Amount is in cents: negative = payment, positive = deposit. ' +
    'Recurrence example: {"frequency":"monthly","interval":1,"start":"2026-10-01","endMode":"never"}. ' +
    'Returns the new schedule with its next date.',
  inputSchema: toJSONSchema(CreateScheduleArgsSchema) as ToolInput,
};

export async function handler(args: CreateScheduleArgs): Promise<CallToolResult> {
  try {
    const {
      name,
      date,
      amount,
      amountOp,
      accountId,
      payeeId,
      postsTransaction = false,
    } = CreateScheduleArgsSchema.parse(args);
    // Reason: Actual can't post a transaction without an account and never reports why.
    if (postsTransaction && accountId === undefined) {
      throw new Error('postsTransaction requires accountId: Actual cannot add a transaction without an account');
    }
    const scheduleAmount = toScheduleAmount(
      amountOp ?? (typeof amount === 'number' ? 'isapprox' : 'isbetween'),
      amount
    );
    const names = await loadNames({ accountId, payeeId });

    const id = await createSchedule({
      name,
      postsTransaction,
      accountId,
      payeeId,
      amount: scheduleAmount,
      date: normalizeScheduleDate(date),
    });

    const created = requireSchedule(await getSchedules(), id);
    return success(`Created schedule:\n${formatSchedule(created, names)}`);
  } catch (err) {
    return errorFromCatch(err);
  }
}
