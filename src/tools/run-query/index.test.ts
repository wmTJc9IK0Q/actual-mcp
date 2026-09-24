import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Query } from '@actual-app/core/shared/query';
import { handler } from './index.js';
import { textContent } from '../../utils/response.js';

vi.mock('../../actual-api.js', () => ({
  initActualApi: vi.fn(),
}));

// Reason: the real Query builder is pure, so tests can assert the query state Actual would receive.
// vi.mock factories are hoisted above static imports, so the builder must be loaded dynamically here.
vi.mock('@actual-app/api', async () => {
  const { q } = await import('@actual-app/core/shared/query');
  return { q, aqlQuery: vi.fn() };
});

import * as api from '@actual-app/api';

/** State of the Query passed to the most recent aqlQuery call. */
function sentQuery(): Query['state'] {
  const [query] = vi.mocked(api.aqlQuery).mock.calls.at(-1) ?? [];
  if (!query) throw new Error('aqlQuery was not called');
  return query.serialize();
}

function json(result: CallToolResult): Record<string, unknown> {
  return JSON.parse(textContent(result.content[0])) as Record<string, unknown>;
}

function rows(n: number): Array<{ id: string }> {
  return Array.from({ length: n }, (_, i) => ({ id: `t${i}` }));
}

describe('run-query tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies filter, select, orderBy and limit, fetching one extra row', async () => {
    vi.mocked(api.aqlQuery).mockResolvedValue({ data: [{ id: 't1', amount: -4500 }] });

    const result = await handler({
      table: 'transactions',
      filter: { 'category.name': 'Groceries', date: { $gte: '2026-09-01' } },
      select: ['date', 'amount'],
      orderBy: [{ date: 'desc' }],
      limit: 10,
      offset: 20,
      splits: 'grouped',
    });

    const state = sentQuery();
    expect(state.table).toBe('transactions');
    expect(state.filterExpressions).toEqual([{ 'category.name': 'Groceries', date: { $gte: '2026-09-01' } }]);
    expect(state.selectExpressions).toEqual(['date', 'amount']);
    expect(state.orderExpressions).toEqual([{ date: 'desc' }]);
    expect(state.limit).toBe(11);
    expect(state.offset).toBe(20);
    expect(state.tableOptions).toEqual({ splits: 'grouped' });
    expect(result.isError).toBeFalsy();
    expect(json(result)).toMatchObject({ rows: [{ id: 't1', amount: -4500 }], count: 1, truncated: false });
  });

  it('selects all fields by default and keeps category groups flat', async () => {
    vi.mocked(api.aqlQuery).mockResolvedValue({ data: [] });

    await handler({ table: 'category_groups' });

    const state = sentQuery();
    expect(state.selectExpressions).toEqual(['*']);
    expect(state.tableOptions).toEqual({ categories: 'none' });
  });

  it('returns the single value of a calculate query', async () => {
    vi.mocked(api.aqlQuery).mockResolvedValue({ data: -12345 });

    const result = await handler({
      table: 'transactions',
      filter: { 'account.name': 'Checking' },
      calculate: { $sum: '$amount' },
    });

    const state = sentQuery();
    expect(state.calculation).toBe(true);
    expect(state.selectExpressions).toEqual([{ result: { $sum: '$amount' } }]);
    expect(state.limit).toBeNull();
    expect(json(result)).toEqual({ table: 'transactions', result: -12345 });
  });

  it('rejects calculate combined with groupBy', async () => {
    const result = await handler({
      table: 'transactions',
      calculate: { $sum: '$amount' },
      groupBy: ['category.name'],
    });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('calculate cannot be combined');
    expect(api.aqlQuery).not.toHaveBeenCalled();
  });

  it('rejects tables outside the allowlist', async () => {
    const result = await handler({ table: 'preferences' } as never);

    expect(result.isError).toBe(true);
    expect(api.aqlQuery).not.toHaveBeenCalled();
  });

  it('rejects splits on non-transaction tables', async () => {
    const result = await handler({ table: 'accounts', splits: 'all' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('splits only applies to the transactions table');
  });

  it('flags truncation when more rows exist than the limit', async () => {
    vi.mocked(api.aqlQuery).mockResolvedValue({ data: rows(3) });

    const result = await handler({ table: 'payees', limit: 2 });

    expect(json(result)).toMatchObject({ rows: rows(2), count: 2, truncated: true, limit: 2 });
  });

  it('clamps the limit to 1000 and defaults it to 100', async () => {
    vi.mocked(api.aqlQuery).mockResolvedValue({ data: [] });

    const clamped = await handler({ table: 'payees', limit: 50000 });
    expect(sentQuery().limit).toBe(1001);
    expect(json(clamped)).toMatchObject({ limit: 1000 });

    await handler({ table: 'payees' });
    expect(sentQuery().limit).toBe(101);
  });

  it('rejects quotes in values Actual would splice into SQL unescaped', async () => {
    const byId = await handler({ table: 'transactions', filter: { id: "x' OR '1'='1" } });
    const byOneof = await handler({
      table: 'transactions',
      filter: { $or: [{ 'payee.name': { $oneof: ["Joe's"] } }] },
    });
    const byAlias = await handler({ table: 'transactions', select: [{ 'x FROM accounts --': { $sum: '$amount' } }] });

    for (const result of [byId, byOneof, byAlias]) {
      expect(result.isError).toBe(true);
    }
    expect(textContent(byId.content[0])).toContain('Single quotes are not allowed');
    expect(api.aqlQuery).not.toHaveBeenCalled();
  });

  it('allows quotes in ordinary string comparisons', async () => {
    vi.mocked(api.aqlQuery).mockResolvedValue({ data: [] });

    const result = await handler({ table: 'transactions', filter: { notes: { $like: "%joe's%" } } });

    expect(result.isError).toBeFalsy();
  });

  it('surfaces ActualQL compile errors', async () => {
    vi.mocked(api.aqlQuery).mockRejectedValue(new Error('Field "categroy" does not exist in table "transactions"'));

    const result = await handler({ table: 'transactions', filter: { categroy: 'x' } });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Field "categroy" does not exist in table "transactions"');
  });
});
