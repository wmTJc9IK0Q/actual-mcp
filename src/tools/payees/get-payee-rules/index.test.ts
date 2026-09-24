import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleEntity } from '@actual-app/core/types/models';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../actual-api.js', () => ({
  getPayees: vi.fn(),
}));

vi.mock('../../../api/payees.js', () => ({
  getPayeeRules: vi.fn(),
}));

import { getPayees } from '../../../actual-api.js';
import { getPayeeRules } from '../../../api/payees.js';

const rule: RuleEntity = {
  id: 'rule-1',
  stage: null,
  conditionsOp: 'and',
  conditions: [{ field: 'payee', op: 'is', value: 'p-a', type: 'id' }],
  actions: [{ field: 'category', op: 'set', value: 'cat-food', type: 'id' }],
};

describe('get-payee-rules tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPayees).mockResolvedValue([{ id: 'p-a', name: 'Amazon', transfer_acct: undefined }]);
  });

  it('returns the rules referencing the payee as JSON', async () => {
    vi.mocked(getPayeeRules).mockResolvedValue([rule]);

    const result = await handler({ payeeId: 'p-a' });

    expect(result.isError).toBeFalsy();
    expect(getPayeeRules).toHaveBeenCalledWith('p-a');
    expect(JSON.parse(textContent(result.content[0]))).toEqual([rule]);
  });

  it('returns an empty list when no rule references the payee', async () => {
    vi.mocked(getPayeeRules).mockResolvedValue([]);

    const result = await handler({ payeeId: 'p-a' });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textContent(result.content[0]))).toEqual([]);
  });

  it('rejects an unknown payee instead of reporting no rules', async () => {
    const result = await handler({ payeeId: 'nope' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Payee not found: nope');
    expect(getPayeeRules).not.toHaveBeenCalled();
  });
});
