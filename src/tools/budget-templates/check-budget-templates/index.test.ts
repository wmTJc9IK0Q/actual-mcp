import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../api/budget-templates.js', () => ({
  checkBudgetTemplates: vi.fn(),
}));

import { checkBudgetTemplates } from '../../../api/budget-templates.js';

describe('check-budget-templates tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms when every template is valid', async () => {
    vi.mocked(checkBudgetTemplates).mockResolvedValue({ type: 'message', message: 'templates-check-passed' });

    const result = await handler();

    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('valid');
  });

  it('lists every failing template line', async () => {
    vi.mocked(checkBudgetTemplates).mockResolvedValue({
      sticky: true,
      message: 'template-errors',
      pre: 'Broken: #template garbage words\n\nBills: Schedule "Rent" does not exist',
    });

    const result = await handler();

    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Broken: #template garbage words');
    expect(text).toContain('Bills: Schedule "Rent" does not exist');
  });

  it('returns an error when the API throws', async () => {
    vi.mocked(checkBudgetTemplates).mockRejectedValue(new Error('Budget not loaded'));

    const result = await handler();

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Budget not loaded');
  });
});
