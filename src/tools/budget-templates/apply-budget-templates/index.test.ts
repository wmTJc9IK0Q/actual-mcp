import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../api/budget-templates.js', () => ({
  applyBudgetTemplates: vi.fn(),
}));

vi.mock('../../../utils.js', () => ({
  getCurrentMonth: vi.fn(() => '2026-09'),
}));

import { applyBudgetTemplates } from '../../../api/budget-templates.js';

describe('apply-budget-templates tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies templates for the requested month', async () => {
    vi.mocked(applyBudgetTemplates).mockResolvedValue({
      type: 'message',
      message: 'Successfully applied templates to 4 categories',
    });

    const result = await handler({ month: '2026-10' });

    expect(applyBudgetTemplates).toHaveBeenCalledWith('2026-10');
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('2026-10');
    expect(textContent(result.content[0])).toContain('4 categories');
  });

  it('defaults to the current month when month is omitted', async () => {
    vi.mocked(applyBudgetTemplates).mockResolvedValue({ type: 'message', message: 'Everything is up to date' });

    await handler({});

    expect(applyBudgetTemplates).toHaveBeenCalledWith('2026-09');
  });

  it('reports template parse errors as a tool error with details', async () => {
    vi.mocked(applyBudgetTemplates).mockResolvedValue({
      sticky: true,
      message: 'There were errors interpreting some templates:',
      pre: 'Groceries: Expected amount',
    });

    const result = await handler({ month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Groceries: Expected amount');
  });

  it('rejects a malformed month without calling the API', async () => {
    const result = await handler({ month: '2026/09' });

    expect(result.isError).toBe(true);
    expect(applyBudgetTemplates).not.toHaveBeenCalled();
  });

  it('returns an error when the API throws', async () => {
    vi.mocked(applyBudgetTemplates).mockRejectedValue(new Error('Budget not loaded'));

    const result = await handler({ month: '2026-09' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Budget not loaded');
  });
});
