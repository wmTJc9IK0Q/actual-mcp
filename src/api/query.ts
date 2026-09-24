// ----------------------------
// ACTUAL API - READ-ONLY QUERIES
// ----------------------------

import * as api from '@actual-app/api';
import { initActualApi } from '../actual-api.js';

/** A field name (e.g. `'category.name'`) or an ActualQL expression object (e.g. `{ $sum: '$amount' }`). */
export type QueryExpression = string | Record<string, unknown>;

/** Declarative description of a read-only ActualQL query. */
export interface QuerySpec {
  table: string;
  filter?: Record<string, unknown>;
  select?: QueryExpression[];
  groupBy?: QueryExpression[];
  orderBy?: QueryExpression[];
  /** Aggregate expression; when set the query returns a single value instead of rows. */
  calculate?: QueryExpression;
  limit?: number;
  offset?: number;
  /** Table options, e.g. `{ splits: 'inline' }` for transactions. */
  options?: Record<string, unknown>;
}

/**
 * Build and run an ActualQL query via `api.aqlQuery` (ensures API is initialized).
 * Only `aqlQuery` is used, which compiles to a single SELECT, so the query cannot mutate the budget.
 *
 * @param spec - Query description
 * @returns The query's `data`: an array of rows, or a single value for `calculate` queries
 */
export async function runAqlQuery(spec: QuerySpec): Promise<unknown> {
  await initActualApi();
  let query = api.q(spec.table);
  if (spec.options) query = query.options(spec.options);
  if (spec.filter) query = query.filter(spec.filter);
  if (spec.calculate !== undefined) {
    query = query.calculate(spec.calculate);
  } else if (spec.select) {
    query = query.select(spec.select);
  }
  if (spec.groupBy) query = query.groupBy(spec.groupBy);
  if (spec.orderBy) query = query.orderBy(spec.orderBy);
  if (spec.limit !== undefined) query = query.limit(spec.limit);
  if (spec.offset !== undefined) query = query.offset(spec.offset);

  const result: unknown = await api.aqlQuery(query);
  if (result && typeof result === 'object' && 'data' in result) return result.data;
  throw new Error('Unexpected aqlQuery result: missing data');
}
