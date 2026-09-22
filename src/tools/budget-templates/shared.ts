// ----------------------------
// BUDGET TEMPLATES - SHARED HELPERS
// ----------------------------

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, error } from '../../utils/response.js';
import { getCurrentMonth } from '../../utils.js';
import type { BudgetTemplateResult } from '../../actual-api.js';

export const BudgetTemplatesArgsSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
    .optional()
    .describe('Month to run the budget templates for, in YYYY-MM format. Defaults to the current month.'),
});

export type BudgetTemplatesArgs = z.infer<typeof BudgetTemplatesArgsSchema>;

/**
 * Validate tool arguments and resolve the target month.
 *
 * @param args - Raw tool arguments
 * @returns The month to run templates for (YYYY-MM)
 */
export function parseMonth(args: unknown): string {
  return BudgetTemplatesArgsSchema.parse(args ?? {}).month ?? getCurrentMonth();
}

/**
 * Convert Actual's template notification into an MCP tool response.
 * Reason: Actual reports template parse errors as a notification (not a thrown error),
 * with the per-category details in `pre`, so they must be surfaced as a tool error explicitly.
 *
 * @param month - The month the templates were run for
 * @param result - Notification returned by Actual
 * @returns Success or error tool response
 */
export function toToolResult(month: string, result: BudgetTemplateResult): CallToolResult {
  const text = result.pre ? `${result.message}\n\n${result.pre}` : result.message;
  if (result.type === 'error' || result.pre) {
    return error(`Budget templates for ${month}: ${text}`);
  }
  return success(`Budget templates for ${month}: ${text}`);
}
