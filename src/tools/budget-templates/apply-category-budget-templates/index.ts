// ----------------------------
// APPLY CATEGORY BUDGET TEMPLATES TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { applyCategoryBudgetTemplates, checkBudgetTemplates } from '../../../api/budget-templates.js';
import { fetchAllCategories } from '../../../core/data/fetch-categories.js';
import { OptionalMonthSchema } from '../../../core/input/validators.js';
import { getCurrentMonth } from '../../../utils.js';
import type { ToolInput } from '../../../types.js';
import { describeChanges, loadMonthBudget } from '../../budget-amounts/shared.js';
import { formatTemplateResult, toToolResult } from '../shared.js';

const ApplyCategoryBudgetTemplatesArgsSchema = z.object({
  categoryIds: z
    .array(z.string().min(1))
    .min(1, 'categoryIds must contain at least one category ID')
    .describe('IDs of the categories whose templates should run'),
  month: OptionalMonthSchema,
});

type ApplyCategoryBudgetTemplatesArgs = z.infer<typeof ApplyCategoryBudgetTemplatesArgsSchema>;

export const schema = {
  name: 'apply-category-budget-templates',
  description:
    'Run the budget templates (from category notes/goals) for only the given categories in a month. ' +
    "Always overwrites: each selected category's existing budgeted amount is replaced by its template amount; " +
    'other categories are untouched. ' +
    'Selected categories without a template keep their budget. Prioritized templates are limited by the money ' +
    'available in "To Budget". Fails without changing anything if a selected category has a template syntax ' +
    'error. Defaults to the current month.',
  inputSchema: toJSONSchema(ApplyCategoryBudgetTemplatesArgsSchema) as ToolInput,
};

/**
 * Find template syntax errors reported by Actual's template check for the given categories.
 * Reason: Actual skips unparseable template lines when applying, and with its forced overwrite a
 * category whose only template is broken gets its budget reset to 0 while reporting success. The
 * check reports errors as "<category name>: <line>" blocks separated by blank lines, so they are
 * matched by name.
 *
 * @param categoryNames - Names of the selected categories
 * @returns Error blocks that belong to the selected categories
 */
async function findTemplateErrors(categoryNames: string[]): Promise<string[]> {
  const { pre } = await checkBudgetTemplates();
  if (!pre) return [];
  return pre.split('\n\n').filter((block) => categoryNames.some((name) => block.startsWith(`${name}: `)));
}

export async function handler(args: ApplyCategoryBudgetTemplatesArgs): Promise<CallToolResult> {
  try {
    const { categoryIds: requestedIds, month = getCurrentMonth() } = ApplyCategoryBudgetTemplatesArgsSchema.parse(args);
    const categoryIds = [...new Set(requestedIds)];

    const selected = (await fetchAllCategories()).filter((category) => categoryIds.includes(category.id));
    const unknownIds = categoryIds.filter((id) => !selected.some((category) => category.id === id));
    if (unknownIds.length > 0) {
      throw new Error(`categoryIds: unknown category ID(s): ${unknownIds.join(', ')}`);
    }

    const templateErrors = await findTemplateErrors(selected.map((category) => category.name));
    if (templateErrors.length > 0) {
      throw new Error(
        `Fix these budget template errors before applying (nothing was changed):\n\n${templateErrors.join('\n\n')}`
      );
    }

    const before = await loadMonthBudget(month);
    const result = await applyCategoryBudgetTemplates(month, categoryIds);
    const response = toToolResult(month, result);
    if (response.isError) return response;

    const after = await loadMonthBudget(month);
    return success(
      `Budget templates for ${month}: ${formatTemplateResult(result)}\n` + describeChanges(before, after, categoryIds)
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
