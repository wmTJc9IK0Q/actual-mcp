import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../actual-api.js', () => ({
  getPayees: vi.fn(),
}));

vi.mock('../../../api/payees.js', () => ({
  mergePayees: vi.fn(),
}));

import { getPayees } from '../../../actual-api.js';
import { mergePayees } from '../../../api/payees.js';

const payees = [
  { id: 'p-a', name: 'Amazon', transfer_acct: undefined },
  { id: 'p-b', name: 'AMZN Mktp', transfer_acct: undefined },
  { id: 'p-c', name: 'Amazon.com', transfer_acct: undefined },
  { id: 'p-savings', name: 'Savings', transfer_acct: 'acct-savings' },
];

describe('merge-payees tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPayees).mockResolvedValue(payees);
  });

  it('merges payees into the target and names them', async () => {
    const result = await handler({ targetPayeeId: 'p-a', mergePayeeIds: ['p-b', 'p-c', 'p-b'] });

    expect(result.isError).toBeFalsy();
    expect(mergePayees).toHaveBeenCalledWith('p-a', ['p-b', 'p-c']);
    const text = textContent(result.content[0]);
    expect(text).toContain('Merged 2 payee(s) into "Amazon": "AMZN Mktp", "Amazon.com"');
    expect(text).toContain('transactions and rules now point to "Amazon"');
  });

  it('rejects merging the target into itself', async () => {
    const result = await handler({ targetPayeeId: 'p-a', mergePayeeIds: ['p-b', 'p-a'] });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('must not include targetPayeeId');
    expect(mergePayees).not.toHaveBeenCalled();
  });

  it('rejects an empty merge list', async () => {
    const result = await handler({ targetPayeeId: 'p-a', mergePayeeIds: [] });

    expect(result.isError).toBe(true);
    expect(mergePayees).not.toHaveBeenCalled();
  });

  it('rejects transfer payees instead of silently skipping them', async () => {
    const asSource = await handler({ targetPayeeId: 'p-a', mergePayeeIds: ['p-savings'] });
    const asTarget = await handler({ targetPayeeId: 'p-savings', mergePayeeIds: ['p-a'] });

    expect(asSource.isError).toBe(true);
    expect(textContent(asSource.content[0])).toContain('"Savings" (p-savings) is a transfer payee');
    expect(asTarget.isError).toBe(true);
    expect(textContent(asTarget.content[0])).toContain('targetPayeeId');
    expect(mergePayees).not.toHaveBeenCalled();
  });

  it('names the argument holding an unknown payee ID', async () => {
    const result = await handler({ targetPayeeId: 'p-a', mergePayeeIds: ['p-b', 'nope'] });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('mergePayeeIds: payee not found: nope');
    expect(mergePayees).not.toHaveBeenCalled();
  });

  it('reports failures from Actual', async () => {
    vi.mocked(mergePayees).mockRejectedValue(new Error('database is locked'));

    const result = await handler({ targetPayeeId: 'p-a', mergePayeeIds: ['p-b'] });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('database is locked');
  });
});
