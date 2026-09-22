import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../actual-api.js', () => ({
  overwriteBudgetTemplates: vi.fn(),
}));

import { overwriteBudgetTemplates } from '../../../actual-api.js';

describe('overwrite-budget-templates tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('overwrites budgets with templates for the requested month', async () => {
    vi.mocked(overwriteBudgetTemplates).mockResolvedValue({
      type: 'message',
      message: 'Successfully applied templates to 12 categories',
    });

    const result = await handler({ month: '2026-11' });

    expect(overwriteBudgetTemplates).toHaveBeenCalledWith('2026-11');
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('12 categories');
  });

  it('reports an error notification as a tool error', async () => {
    vi.mocked(overwriteBudgetTemplates).mockResolvedValue({ type: 'error', message: 'Template failed' });

    const result = await handler({ month: '2026-11' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Template failed');
  });

  it('rejects a malformed month without calling the API', async () => {
    const result = await handler({ month: 'next month' });

    expect(result.isError).toBe(true);
    expect(overwriteBudgetTemplates).not.toHaveBeenCalled();
  });
});
