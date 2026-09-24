// ----------------------------
// MERGE PAYEES TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { APIPayeeEntity } from '@actual-app/api/models';
import { success, errorFromCatch } from '../../../utils/response.js';
import { getPayees } from '../../../actual-api.js';
import { mergePayees } from '../../../api/payees.js';
import type { ToolInput } from '../../../types.js';

const MergePayeesArgsSchema = z.object({
  targetPayeeId: z.string().min(1).describe('ID of the payee to keep; the other payees are merged into it'),
  mergePayeeIds: z
    .array(z.string().min(1))
    .min(1)
    .describe('IDs of the payees to merge into the target and delete. Must not include the target.'),
});

type MergePayeesArgs = z.infer<typeof MergePayeesArgsSchema>;

export const schema = {
  name: 'merge-payees',
  description:
    'Merge one or more payees into a target payee. Transactions and rules referencing the merged payees ' +
    'are reassigned to the target, and the merged payees are deleted. Transfer payees cannot be merged.',
  inputSchema: toJSONSchema(MergePayeesArgsSchema) as ToolInput,
};

/**
 * Look up a payee by ID and ensure it is a regular (non-transfer) payee.
 *
 * @param payeesById - All payees keyed by ID
 * @param id - Payee ID to resolve
 * @param argName - Argument name used in error messages
 * @returns The matching payee
 */
function requireRegularPayee(payeesById: Map<string, APIPayeeEntity>, id: string, argName: string): APIPayeeEntity {
  const payee = payeesById.get(id);
  if (!payee) {
    throw new Error(`${argName}: payee not found: ${id}`);
  }
  // Reason: Actual silently skips transfer payees when merging, so reject them up front instead.
  if (payee.transfer_acct) {
    throw new Error(`${argName}: "${payee.name}" (${id}) is a transfer payee and cannot be merged`);
  }
  return payee;
}

export async function handler(args: MergePayeesArgs): Promise<CallToolResult> {
  try {
    const { targetPayeeId, mergePayeeIds } = MergePayeesArgsSchema.parse(args);
    const mergeIds = [...new Set(mergePayeeIds)];
    // Reason: Actual would remap the target to itself and then delete it, losing the payee.
    if (mergeIds.includes(targetPayeeId)) {
      throw new Error('mergePayeeIds must not include targetPayeeId');
    }

    const payeesById = new Map((await getPayees()).map((payee) => [payee.id, payee]));
    const target = requireRegularPayee(payeesById, targetPayeeId, 'targetPayeeId');
    const merged = mergeIds.map((id) => requireRegularPayee(payeesById, id, 'mergePayeeIds'));

    await mergePayees(targetPayeeId, mergeIds);

    const names = merged.map((payee) => `"${payee.name}"`).join(', ');
    return success(
      `Merged ${merged.length} payee(s) into "${target.name}": ${names}.\n` +
        `Their transactions and rules now point to "${target.name}", and the merged payees were deleted.`
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
