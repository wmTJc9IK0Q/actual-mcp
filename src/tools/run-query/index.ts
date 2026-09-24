// ----------------------------
// RUN QUERY TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { successWithJson, errorFromCatch } from '../../utils/response.js';
import { runAqlQuery } from '../../api/query.js';
import type { QuerySpec } from '../../api/query.js';
import type { ToolInput } from '../../types.js';
import { assertNoUnsafeLiterals } from './safety.js';

/** Tables exposed by Actual's ActualQL schema that are useful to query. */
const QUERYABLE_TABLES = [
  'transactions',
  'accounts',
  'categories',
  'category_groups',
  'payees',
  'schedules',
  'rules',
  'notes',
] as const;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const ExpressionSchema = z.union([z.string().min(1), z.record(z.string(), z.unknown())]);

/** Select aliases are spliced into SQL as `AS <alias>`, so they must be plain identifiers. */
const SELECT_ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;

const RunQueryArgsSchema = z
  .object({
    table: z.enum(QUERYABLE_TABLES).describe('Table to query'),
    filter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'ActualQL filter object. Operators: $eq, $ne, $lt, $lte, $gt, $gte, $oneof (array), $like / $notlike ' +
          '(SQL LIKE, % wildcard, case/diacritic-insensitive), $regexp, $and / $or (arrays of filters), and ' +
          '$transform on the field (e.g. "$month", "$year", "$lower"). A bare value means $eq; null matches missing values.'
      ),
    select: z
      .array(ExpressionSchema)
      .min(1)
      .optional()
      .describe(
        'Fields to return (default "*"). Strings are field names or joined paths ("category.name"); objects name an ' +
          'expression: { "total": { "$sum": "$amount" } }. Non-aggregate queries always include "id".'
      ),
    groupBy: z
      .array(ExpressionSchema)
      .min(1)
      .optional()
      .describe('Group rows by fields or expressions, e.g. ["category.name"] or [{ "$month": "$date" }]'),
    orderBy: z
      .array(ExpressionSchema)
      .min(1)
      .optional()
      .describe(
        'Sort order, e.g. ["date"] or [{ "amount": "desc" }] (one field per object). Select aliases cannot be ' +
          'referenced; to sort by an aggregate repeat it with $dir: [{ "$sum": "$amount", "$dir": "asc" }]'
      ),
    calculate: ExpressionSchema.optional().describe(
      'Single aggregate value instead of rows, e.g. { "$sum": "$amount" } or { "$count": "$id" }. ' +
        'Cannot be combined with select or groupBy.'
    ),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(`Maximum rows to return (default ${DEFAULT_LIMIT}, capped at ${MAX_LIMIT})`),
    offset: z.number().int().min(0).optional().describe('Rows to skip, for paging'),
    splits: z
      .enum(['inline', 'grouped', 'all', 'none'])
      .optional()
      .describe(
        'Transactions only. How split transactions appear: "inline" (default: split children replace their parent, ' +
          'right for sums), "grouped" (parents with nested subtransactions), "all" (parents and children), ' +
          '"none" (parents only, no children)'
      ),
  })
  .refine((args) => args.calculate === undefined || (args.select === undefined && args.groupBy === undefined), {
    message: 'calculate cannot be combined with select or groupBy',
  })
  .refine((args) => args.splits === undefined || args.table === 'transactions', {
    message: 'splits only applies to the transactions table',
  });

type RunQueryArgs = z.infer<typeof RunQueryArgsSchema>;

export const schema = {
  name: 'run-query',
  description:
    'Run a read-only ActualQL query against the budget for ad-hoc analysis. Returns JSON { rows, count, truncated } ' +
    '(or { result } for calculate). Amounts are integer cents (-4500 = $45.00 spent); dates are "YYYY-MM-DD". ' +
    'Reference fields of related tables with dot paths (transactions: account.name, payee.name, category.name, ' +
    'category.group.name; categories: group.name). Deleted items are excluded. Examples:\n' +
    '- Grocery spending in Q1: {"table":"transactions","filter":{"category.name":"Groceries",' +
    '"date":{"$gte":"2026-01-01","$lte":"2026-03-31"}},"select":["date","payee.name","amount","notes"],' +
    '"orderBy":[{"date":"desc"}]}\n' +
    '- Spending per category for a month: {"table":"transactions","filter":{"date":{"$transform":"$month",' +
    '"$eq":"2026-09"},"amount":{"$lt":0}},"groupBy":["category.name"],"select":["category.name",' +
    '{"total":{"$sum":"$amount"}}],"orderBy":[{"$sum":"$amount","$dir":"asc"}]}\n' +
    '- Account balance: {"table":"transactions","filter":{"account.name":"Checking"},"calculate":{"$sum":"$amount"}}',
  inputSchema: toJSONSchema(RunQueryArgsSchema) as ToolInput,
};

/**
 * Turn validated tool args into a query spec. Row queries fetch one extra row so truncation is detectable.
 *
 * @param args - Parsed tool arguments
 * @param limit - Effective (clamped) row limit
 */
function toQuerySpec(args: RunQueryArgs, limit: number): QuerySpec {
  const isCalculation = args.calculate !== undefined;
  return {
    table: args.table,
    filter: args.filter,
    select: isCalculation ? undefined : (args.select ?? ['*']),
    groupBy: args.groupBy,
    orderBy: args.orderBy,
    calculate: args.calculate,
    limit: isCalculation ? undefined : limit + 1,
    offset: args.offset,
    // Reason: category_groups otherwise nests every category under each row (and breaks aggregate
    // rows); flat rows keep output uniform — query `categories` with `group.name` for that view.
    options:
      args.table === 'category_groups' ? { categories: 'none' } : args.splits ? { splits: args.splits } : undefined,
  };
}

/**
 * Reject select aliases that are not plain identifiers.
 *
 * @param select - Select expressions from the tool args
 */
function assertValidAliases(select: RunQueryArgs['select']): void {
  for (const expr of select ?? []) {
    if (typeof expr === 'string') continue;
    for (const alias of Object.keys(expr)) {
      if (alias.startsWith('$')) continue; // Actual reports a clear error for unnamed functions
      if (!SELECT_ALIAS.test(alias)) {
        throw new Error(`Invalid select alias "${alias}": use letters, digits and underscores only`);
      }
    }
  }
}

export async function handler(args: RunQueryArgs): Promise<CallToolResult> {
  try {
    const parsed = RunQueryArgsSchema.parse(args);
    assertValidAliases(parsed.select);
    assertNoUnsafeLiterals({
      filter: parsed.filter,
      select: parsed.select,
      groupBy: parsed.groupBy,
      orderBy: parsed.orderBy,
      calculate: parsed.calculate,
    });

    const limit = Math.min(parsed.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const data = await runAqlQuery(toQuerySpec(parsed, limit));

    if (parsed.calculate !== undefined) {
      return successWithJson({ table: parsed.table, result: data });
    }
    if (!Array.isArray(data)) {
      throw new Error('Query returned no row list');
    }
    const truncated = data.length > limit;
    const rows = truncated ? data.slice(0, limit) : data;
    return successWithJson({
      table: parsed.table,
      rows,
      count: rows.length,
      truncated,
      limit,
      offset: parsed.offset ?? 0,
    });
  } catch (err) {
    return errorFromCatch(err);
  }
}
