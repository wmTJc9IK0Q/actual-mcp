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
  const message = describeTemplateMessage(result);
  return result.pre ? `${message}\n\n${result.pre}` : message;
}

/**
 * Turn Actual's notification message into a sentence.
 * Reason: since Actual 26.9 the message is a translation key for the web UI (e.g. `templates-applied`
 * with `count`). Unknown keys and older servers' plain sentences are returned unchanged.
 *
 * @param result - Notification returned by Actual
 * @returns Human-readable message
 */
function describeTemplateMessage(result: BudgetTemplateResult): string {
  const sources = result.sourceCount ?? 0;
  const sinks = result.sinkCount ?? 0;
  switch (result.message) {
    case 'templates-applied':
      return `Applied templates to ${result.count ?? 0} categories.`;
    case 'templates-up-to-date':
      return 'Everything is up to date.';
    case 'templates-check-passed':
      return 'All templates passed.';
    case 'template-errors':
      return 'There were errors interpreting some templates:';
    case 'cleanup-applied':
      return `Returned funds from ${sources} sources and funded ${sinks} sinking funds.`;
    case 'cleanup-applied-with-errors':
      return `Returned funds from ${sources} sources and funded ${sinks} sinking funds, with errors:`;
    case 'cleanup-up-to-date':
      return 'All categories were up to date.';
    case 'cleanup-no-funds':
      return 'Cleanup could not fully complete:';
    default:
      return result.message;
  }
}
