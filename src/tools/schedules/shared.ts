// ----------------------------
// SCHEDULE TOOLS - SHARED
// ----------------------------

import { z } from 'zod';
import type { APIScheduleEntity } from '@actual-app/core/server/api-models';
import type { RecurConfig, RecurPattern } from '@actual-app/core/types/models';
import { getAccounts, getPayees } from '../../actual-api.js';
import type { AmountRange, ScheduleAmount } from '../../api/schedules.js';
import { formatAmount } from '../../utils.js';

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const WEEKDAY_NAMES: Record<(typeof WEEKDAYS)[number], string> = {
  SU: 'Sunday',
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
};

/** Calendar date in YYYY-MM-DD format that actually exists (rejects e.g. 2026-02-30). */
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
  .refine(isRealDate, 'date must be a valid calendar date');

const RecurPatternSchema = z
  .strictObject({
    type: z
      .enum([...WEEKDAYS, 'day'])
      .describe('"day" for a day of the month, or a weekday code (SU, MO, TU, WE, TH, FR, SA)'),
    value: z
      .number()
      .int()
      .describe(
        'For "day": day of month 1-31, or -1 for the last day. For a weekday: which one in the month 1-5, or -1 for the last'
      ),
  })
  .superRefine((pattern, ctx) => {
    const max = pattern.type === 'day' ? 31 : 5;
    if (pattern.value !== -1 && (pattern.value < 1 || pattern.value > max)) {
      ctx.addIssue({ code: 'custom', message: `pattern value for "${pattern.type}" must be 1-${max} or -1 (last)` });
    }
  });

/** Actual's recurring date config (schedule `date` when the schedule repeats). */
export const RecurConfigSchema = z
  .strictObject({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).describe('How often the schedule repeats'),
    interval: z.number().int().min(1).optional().describe('Repeat every N periods (default 1)'),
    start: DateSchema.describe('First occurrence, YYYY-MM-DD'),
    endMode: z
      .enum(['never', 'after_n_occurrences', 'on_date'])
      .optional()
      .describe('When the recurrence ends (default "never")'),
    endOccurrences: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Number of occurrences; required when endMode is "after_n_occurrences"'),
    endDate: DateSchema.optional().describe('Last possible date, YYYY-MM-DD; required when endMode is "on_date"'),
    patterns: z
      .array(RecurPatternSchema)
      .optional()
      .describe(
        'Monthly only: specific days, e.g. [{type:"day",value:15},{type:"FR",value:-1}] = the 15th and last Friday'
      ),
    skipWeekend: z.boolean().optional().describe('Move occurrences that fall on a weekend'),
    weekendSolveMode: z
      .enum(['before', 'after'])
      .optional()
      .describe('With skipWeekend: move to the Friday before or the Monday after (default "after")'),
  })
  .superRefine((config, ctx) => {
    const endMode = config.endMode ?? 'never';
    if (endMode === 'after_n_occurrences' && config.endOccurrences === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['endOccurrences'],
        message: 'endOccurrences is required when endMode is "after_n_occurrences"',
      });
    }
    if (endMode !== 'after_n_occurrences' && config.endOccurrences !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['endOccurrences'],
        message: 'endOccurrences is only used with endMode "after_n_occurrences"',
      });
    }
    if (endMode === 'on_date' && config.endDate === undefined) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate is required when endMode is "on_date"' });
    }
    if (endMode !== 'on_date' && config.endDate !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate is only used with endMode "on_date"' });
    }
    if (config.endDate !== undefined && config.endDate < config.start) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate must not be before start' });
    }
    if (config.patterns?.length && config.frequency !== 'monthly') {
      ctx.addIssue({
        code: 'custom',
        path: ['patterns'],
        message: 'patterns are only supported for monthly schedules',
      });
    }
    if (config.weekendSolveMode !== undefined && !config.skipWeekend) {
      ctx.addIssue({
        code: 'custom',
        path: ['weekendSolveMode'],
        message: 'weekendSolveMode requires skipWeekend: true',
      });
    }
  });

/** Schedule date: a one-time date or a recurrence config. */
export const ScheduleDateSchema = z
  .union([DateSchema, RecurConfigSchema])
  .describe('One-time date as YYYY-MM-DD, or a recurrence config object');

const AmountRangeSchema = z.strictObject({
  num1: z.number().int().describe('One bound in cents'),
  num2: z.number().int().describe('Other bound in cents'),
});

/** Schedule amount: integer cents, or a {num1, num2} range for `isbetween`. */
export const ScheduleAmountValueSchema = z
  .union([z.number().int(), AmountRangeSchema])
  .describe(
    'Amount in cents; negative = payment/expense, positive = deposit (e.g. -12030 = paying $120.30). ' +
      'Use {num1, num2} with amountOp "isbetween".'
  );

export const AmountOpSchema = z
  .enum(['is', 'isapprox', 'isbetween'])
  .describe('"is" exact, "isapprox" within 7.5%, "isbetween" a {num1, num2} range');

type AmountOp = z.infer<typeof AmountOpSchema>;
type RecurConfigInput = z.infer<typeof RecurConfigSchema>;

/** Account and payee display names keyed by ID. */
export interface NameLookup {
  accounts: Map<string, string>;
  payees: Map<string, string>;
}

/**
 * Pair an amount operator with a value, rejecting combinations Actual would store as an invalid rule.
 *
 * @param op - Amount operator
 * @param value - Amount in cents, or a range
 */
export function toScheduleAmount(op: AmountOp, value: number | AmountRange): ScheduleAmount {
  if (op === 'isbetween') {
    if (typeof value === 'number') throw new Error('amountOp "isbetween" requires amount as {num1, num2}');
    return { op, value };
  }
  if (typeof value !== 'number')
    throw new Error(`amount {num1, num2} is only valid with amountOp "isbetween", not "${op}"`);
  return { op, value };
}

/**
 * Fill in Actual's implicit recurrence defaults so the stored config is explicit.
 * Reason: Actual throws while computing dates when skipWeekend is set without a solve mode.
 *
 * @param date - One-time date or parsed recurrence config
 */
export function normalizeScheduleDate(date: string | RecurConfigInput): string | RecurConfig {
  if (typeof date === 'string') return date;
  return {
    ...date,
    interval: date.interval ?? 1,
    endMode: date.endMode ?? 'never',
    ...(date.skipWeekend ? { weekendSolveMode: date.weekendSolveMode ?? 'after' } : {}),
  };
}

/**
 * Load account/payee names, verifying that any referenced IDs exist.
 * Reason: Actual stores unknown IDs in the schedule's rule without complaint.
 *
 * @param refs - Account/payee IDs supplied by the caller
 */
export async function loadNames(refs: { accountId?: string; payeeId?: string } = {}): Promise<NameLookup> {
  const [accounts, payees] = await Promise.all([getAccounts(), getPayees()]);
  const names: NameLookup = {
    accounts: new Map(accounts.map((a) => [a.id, a.name])),
    payees: new Map(payees.map((p) => [p.id, p.name])),
  };
  if (refs.accountId !== undefined && !names.accounts.has(refs.accountId)) {
    throw new Error(`Account not found: ${refs.accountId}`);
  }
  if (refs.payeeId !== undefined && !names.payees.has(refs.payeeId)) {
    throw new Error(`Payee not found: ${refs.payeeId}`);
  }
  return names;
}

/**
 * Find a schedule by ID or throw.
 *
 * @param schedules - All schedules
 * @param id - Schedule ID
 */
export function requireSchedule(schedules: APIScheduleEntity[], id: string): APIScheduleEntity {
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) throw new Error(`Schedule not found: ${id}`);
  return schedule;
}

/** Display name of a schedule. */
export function scheduleLabel(schedule: APIScheduleEntity): string {
  return schedule.name ? `"${schedule.name}"` : '(unnamed)';
}

/**
 * Describe a schedule amount, e.g. "-$50.00", "approx. -$50.00", "between -$40.00 and -$60.00".
 *
 * @param op - Amount operator
 * @param amount - Amount in cents or range
 */
export function describeAmount(op: string, amount: APIScheduleEntity['amount']): string {
  if (amount === undefined || amount === null) return 'none';
  if (typeof amount !== 'number') {
    const [low, high] = [amount.num1, amount.num2].sort((a, b) => a - b);
    return `between ${formatAmount(low)} and ${formatAmount(high)}`;
  }
  return op === 'isapprox' ? `approx. ${formatAmount(amount)}` : formatAmount(amount);
}

/** English ordinal for a positive integer (1st, 2nd, 3rd, 4th, ...). */
function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** Describe one monthly pattern, e.g. "the 15th", "the last day", "the 2nd Friday". */
function describePattern(pattern: RecurPattern): string {
  const which = pattern.value === -1 ? 'last' : ordinal(pattern.value);
  return pattern.type === 'day'
    ? `the ${which}${pattern.value === -1 ? ' day' : ''}`
    : `the ${which} ${WEEKDAY_NAMES[pattern.type]}`;
}

/**
 * Human-readable summary of a schedule date, e.g.
 * "every 2 months on the 15th, starting 2026-09-15, until 2027-06-30; weekends move to the Monday after".
 *
 * @param date - One-time date or recurrence config
 */
export function describeRecurrence(date: string | RecurConfig): string {
  if (typeof date === 'string') return `once on ${date}`;
  const units = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const;
  const interval = date.interval ?? 1;
  const unit = units[date.frequency];
  let text = interval === 1 ? `every ${unit}` : `every ${interval} ${unit}s`;
  if (date.frequency === 'monthly' && date.patterns?.length) {
    text += ` on ${date.patterns.map(describePattern).join(', ')}`;
  }
  text += `, starting ${date.start}`;
  if (date.endMode === 'after_n_occurrences') text += `, ${date.endOccurrences} times`;
  if (date.endMode === 'on_date') text += `, until ${date.endDate}`;
  if (date.skipWeekend) {
    text += `; weekends move to the ${date.weekendSolveMode === 'before' ? 'Friday before' : 'Monday after'}`;
  }
  return text;
}

/**
 * Multi-line human-readable description of a schedule with resolved account/payee names.
 *
 * @param schedule - Schedule to describe
 * @param names - Account/payee name lookup
 */
export function formatSchedule(schedule: APIScheduleEntity, names: NameLookup): string {
  const account = schedule.account ? (names.accounts.get(schedule.account) ?? `unknown (${schedule.account})`) : 'any';
  const payee = schedule.payee ? (names.payees.get(schedule.payee) ?? `unknown (${schedule.payee})`) : 'any';
  return [
    `- ${scheduleLabel(schedule)} (id: ${schedule.id})`,
    `  Next date: ${schedule.next_date ?? 'none'} | Amount: ${describeAmount(schedule.amountOp, schedule.amount)} (${schedule.amountOp})`,
    `  Account: ${account} | Payee: ${payee}`,
    `  Recurrence: ${describeRecurrence(schedule.date)}`,
    `  Auto-post transaction: ${schedule.posts_transaction ? 'yes' : 'no'} | Completed: ${schedule.completed ? 'yes' : 'no'}`,
  ].join('\n');
}

/** Whether a YYYY-MM-DD string names a real calendar day. */
function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
