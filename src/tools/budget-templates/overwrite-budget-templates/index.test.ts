import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../api/budget-templates.js', () => ({
  checkBudgetTemplates: vi.fn(),
  overwriteBudgetTemplates: vi.fn(),
}));

import { checkBudgetTemplates, overwriteBudgetTemplates } from '../../../api/budget-templates.js';

describe('overwrite-budget-templates tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkBudgetTemplates).mockResolvedValue({ type: 'message', message: 'All templates passed!' });
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

  it('refuses to overwrite when any template has a syntax error', async () => {
    vi.mocked(checkBudgetTemplates).mockResolvedValue({
      sticky: true,
      message: 'There were errors interpreting some templates:',
      pre: 'Broken: #template garbage words',
    });

    const result = await handler({ month: '2026-11' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Broken: #template garbage words');
    expect(overwriteBudgetTemplates).not.toHaveBeenCalled();
  });

  it('rejects a malformed month without calling the API', async () => {
    const result = await handler({ month: 'next month' });

    expect(result.isError).toBe(true);
    expect(overwriteBudgetTemplates).not.toHaveBeenCalled();
  });
});
