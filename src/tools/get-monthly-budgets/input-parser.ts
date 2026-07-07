// Parses and validates input arguments for the get-monthly-budgets tool.
import { getCurrentMonth } from '../../utils.js';

export interface MonthlyBudgetsInput {
  startMonth: string;
  endMonth: string;
}

const MONTH_REGEX = /^\d{4}-\d{2}$/;

function validateMonth(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !MONTH_REGEX.test(value)) {
    throw new Error(`${field} must be a string in YYYY-MM format`);
  }
  return value;
}

export class MonthlyBudgetsInputParser {
  /**
   * Resolve the requested month range, applying defaults:
   * - Neither given → the current month only.
   * - Only startMonth → startMonth through the current month (or just startMonth if it is in the future).
   * - Only endMonth → that single month.
   * - Both given → the inclusive range (startMonth must not be after endMonth).
   */
  parse(args: unknown): MonthlyBudgetsInput {
    const argsObj = args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
    const startMonth = validateMonth(argsObj.startMonth, 'startMonth');
    const endMonth = validateMonth(argsObj.endMonth, 'endMonth');
    const current = getCurrentMonth();

    if (startMonth && endMonth) {
      if (startMonth > endMonth) {
        throw new Error('startMonth must be before or equal to endMonth');
      }
      return { startMonth, endMonth };
    }
    if (startMonth) {
      return { startMonth, endMonth: startMonth > current ? startMonth : current };
    }
    if (endMonth) {
      return { startMonth: endMonth, endMonth };
    }
    return { startMonth: current, endMonth: current };
  }
}
