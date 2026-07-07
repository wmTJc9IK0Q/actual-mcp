// Generates the markdown report for the get-monthly-budgets tool.
import { formatAmount } from '../../utils.js';
import type { BudgetCategory, BudgetCategoryGroup, BudgetMonth } from './types.js';

// Income categories report `received` instead of `spent`; treat it as the
// "spent" column so a single table shape works for every group.
function categorySpent(category: BudgetCategory): number {
  return category.spent ?? category.received ?? 0;
}

function groupSpent(group: BudgetCategoryGroup, fallback: number): number {
  return group.spent ?? group.received ?? fallback;
}

export class MonthlyBudgetsReportGenerator {
  /**
   * Render the per-month budget breakdown as markdown, grouped by category
   * group with a subtotal row per group.
   *
   * @param months - Budget data for each month in the range
   * @param range - The requested range, used for the header
   * @returns Markdown report string
   */
  generate(months: BudgetMonth[], range: { start: string; end: string }): string {
    let markdown = `# Monthly Budgets\n\n`;
    markdown += `Range: ${range.start} to ${range.end}\n\n`;

    if (months.length === 0) {
      markdown += `No budget data available for the requested range.\n`;
      return markdown;
    }

    for (const month of months) {
      markdown += `## ${month.month}\n\n`;
      markdown += `Budgeted: ${formatAmount(month.totalBudgeted)} | Spent: ${formatAmount(
        month.totalSpent
      )} | Balance: ${formatAmount(month.totalBalance)}\n\n`;

      for (const group of month.categoryGroups ?? []) {
        const categories = group.categories ?? [];
        if (categories.length === 0) continue;

        markdown += `### ${group.name}\n`;
        markdown += `| Category | Budgeted | Spent | Balance |\n`;
        markdown += `| -------- | -------- | ----- | ------- |\n`;

        let sumBudgeted = 0;
        let sumSpent = 0;
        let sumBalance = 0;
        for (const category of categories) {
          const budgeted = category.budgeted ?? 0;
          const spent = categorySpent(category);
          const balance = category.balance ?? 0;
          sumBudgeted += budgeted;
          sumSpent += spent;
          sumBalance += balance;
          // A carryover flag means the balance rolls into next month; mark it inline.
          const carry = category.carryover ? ' ↩' : '';
          markdown += `| ${category.name} | ${formatAmount(budgeted)} | ${formatAmount(spent)} | ${formatAmount(
            balance
          )}${carry} |\n`;
        }

        markdown += `| **Total** | ${formatAmount(group.budgeted ?? sumBudgeted)} | ${formatAmount(
          groupSpent(group, sumSpent)
        )} | ${formatAmount(group.balance ?? sumBalance)} |\n\n`;
      }
    }

    return markdown;
  }
}
