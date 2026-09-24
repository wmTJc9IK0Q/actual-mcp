// ----------------------------
// BUDGET TEMPLATES - SHARED HELPERS
// ----------------------------

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, error } from '../../utils/response.js';
import { getCurrentMonth } from '../../utils.js';
import type { BudgetTemplateResult } from '../../api/budget-templates.js';
import { OptionalMonthSchema } from '../../core/input/validators.js';

export const BudgetTemplatesArgsSchema = z.object({
  month: OptionalMonthSchema,
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
  const text = formatTemplateResult(result);
  if (result.type === 'error' || result.pre) {
    return error(`Budget templates for ${month}: ${text}`);
  }
  return success(`Budget templates for ${month}: ${text}`);
}

/**
 * Render Actual's template notification as text: the message plus any `pre` details.
 *
 * @param result - Notification returned by Actual
 * @returns Human-readable notification text
 */
export function formatTemplateResult(result: BudgetTemplateResult): string {
  return result.pre ? `${result.message}\n\n${result.pre}` : result.message;
}
