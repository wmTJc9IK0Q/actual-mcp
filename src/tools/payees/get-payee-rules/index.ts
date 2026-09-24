// ----------------------------
// GET PAYEE RULES TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { successWithJson, errorFromCatch } from '../../../utils/response.js';
import { getPayees } from '../../../actual-api.js';
import { getPayeeRules } from '../../../api/payees.js';
import type { ToolInput } from '../../../types.js';

const GetPayeeRulesArgsSchema = z.object({
  payeeId: z.string().min(1).describe('ID of the payee whose rules to list'),
});

type GetPayeeRulesArgs = z.infer<typeof GetPayeeRulesArgsSchema>;

export const schema = {
  name: 'get-payee-rules',
  description:
    'Retrieve the rules that reference a payee, either in a condition (is / is not / one of / not one of) ' +
    'or in a "set payee" action. Same rule format as get-rules; amounts are in cents.',
  inputSchema: toJSONSchema(GetPayeeRulesArgsSchema) as ToolInput,
};

export async function handler(args: GetPayeeRulesArgs): Promise<CallToolResult> {
  try {
    const { payeeId } = GetPayeeRulesArgsSchema.parse(args);
    // Reason: Actual returns an empty list for unknown IDs, which would hide a typo as "no rules".
    const payees = await getPayees();
    if (!payees.some((payee) => payee.id === payeeId)) {
      throw new Error(`Payee not found: ${payeeId}`);
    }

    return successWithJson(await getPayeeRules(payeeId));
  } catch (err) {
    return errorFromCatch(err);
  }
}
