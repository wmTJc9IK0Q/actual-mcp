// Shared validators for input data
import { z } from 'zod';

/**
 * Optional YYYY-MM month argument for tools that act on a single budget month.
 * Callers default a missing value to the current month.
 */
export const OptionalMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
  .optional()
  .describe('Budget month in YYYY-MM format. Defaults to the current month.');
