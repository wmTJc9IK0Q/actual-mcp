import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../actual-api.js', () => ({
  getCategories: vi.fn(),
  getAccounts: vi.fn(),
}));

vi.mock('../../../api/notes.js', () => ({
  getNote: vi.fn(),
}));

import { getAccounts, getCategories } from '../../../actual-api.js';
import { getNote } from '../../../api/notes.js';

describe('get-note tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([{ id: 'cat-food', name: 'Food', group_id: 'g1' }]);
    vi.mocked(getAccounts).mockResolvedValue([
      { id: 'acc-checking', name: 'Checking', offbudget: false, closed: false },
    ]);
  });

  it('returns the note of a category', async () => {
    vi.mocked(getNote).mockResolvedValue('#template 100');

    const result = await handler({ id: 'cat-food' });

    expect(getNote).toHaveBeenCalledWith('cat-food');
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toBe('Note for category "Food":\n#template 100');
  });

  it('reads the budget-YYYY-MM note for a month without looking up entities', async () => {
    vi.mocked(getNote).mockResolvedValue('- transferred $10.00');

    const result = await handler({ month: '2026-09' });

    expect(getNote).toHaveBeenCalledWith('budget-2026-09');
    expect(getCategories).not.toHaveBeenCalled();
    expect(textContent(result.content[0])).toContain('budget month 2026-09');
  });

  it('says clearly when an account has no note', async () => {
    vi.mocked(getNote).mockResolvedValue(null);

    const result = await handler({ id: 'acc-checking' });

    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toBe('No note exists for account "Checking".');
  });

  it('rejects an id that is neither a category nor an account', async () => {
    const result = await handler({ id: 'typo' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('No category or account found with id "typo"');
    expect(getNote).not.toHaveBeenCalled();
  });

  it.each([{ id: 'cat-food', month: '2026-09' }, {}])('requires exactly one of id or month (%j)', async (args) => {
    const result = await handler(args);

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('exactly one of id');
    expect(getNote).not.toHaveBeenCalled();
  });
});
