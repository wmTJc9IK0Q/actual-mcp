// Fetches per-month budget data for the get-monthly-budgets tool.
import { getBudgetMonth, getBudgetMonths } from '../../actual-api.js';
import { enumerateMonths } from '../../utils.js';
import type { BudgetMonth } from './types.js';

export class MonthlyBudgetsDataFetcher {
  /**
   * Fetch budget data for every month in the requested range that actually has
   * budget data. Months outside the set returned by getBudgetMonths() are
   * skipped so we never call getBudgetMonth() on a non-existent month.
   *
   * @param startMonth - Inclusive start month (YYYY-MM)
   * @param endMonth - Inclusive end month (YYYY-MM)
   * @returns One BudgetMonth entry per available month, in chronological order
   */
  async fetchAll(startMonth: string, endMonth: string): Promise<BudgetMonth[]> {
    const available = new Set(await getBudgetMonths());
    const months = enumerateMonths(startMonth, endMonth).filter((month) => available.has(month));

    const result: BudgetMonth[] = [];
    for (const month of months) {
      // Reason: getBudgetMonth types its category groups loosely (Record<string, unknown>);
      // our BudgetMonth interface documents the fields we actually consume.
      result.push((await getBudgetMonth(month)) as unknown as BudgetMonth);
    }
    return result;
  }
}
