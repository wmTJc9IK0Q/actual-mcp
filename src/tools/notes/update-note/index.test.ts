import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../actual-api.js', () => ({
  getCategories: vi.fn(),
  getAccounts: vi.fn(),
}));

vi.mock('../../../api/notes.js', () => ({
  getNote: vi.fn(),
  updateNote: vi.fn(),
}));

import { getAccounts, getCategories } from '../../../actual-api.js';
import { getNote, updateNote } from '../../../api/notes.js';

describe('update-note tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([{ id: 'cat-food', name: 'Food', group_id: 'g1' }]);
    vi.mocked(getAccounts).mockResolvedValue([
      { id: 'acc-checking', name: 'Checking', offbudget: false, closed: false },
    ]);
  });

  it('replaces the whole note of a category', async () => {
    const result = await handler({ id: 'cat-food', note: '#template 100' });

    expect(updateNote).toHaveBeenCalledWith('cat-food', '#template 100');
    expect(getNote).not.toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain('Updated note for category "Food"');
  });

  it('appends on a new line, preserving the existing note', async () => {
    vi.mocked(getNote).mockResolvedValue('Groceries and dining');

    const result = await handler({ id: 'cat-food', note: '#template 100', append: true });

    expect(updateNote).toHaveBeenCalledWith('cat-food', 'Groceries and dining\n#template 100');
    expect(textContent(result.content[0])).toContain('Appended to note');
  });

  it('does not add a blank line when appending to a note ending in a newline', async () => {
    vi.mocked(getNote).mockResolvedValue('line one\n');

    await handler({ month: '2026-09', note: 'line two', append: true });

    expect(updateNote).toHaveBeenCalledWith('budget-2026-09', 'line one\nline two');
  });

  it('appending to a missing note just writes the text', async () => {
    vi.mocked(getNote).mockResolvedValue(null);

    await handler({ id: 'acc-checking', note: 'Joint account', append: true });

    expect(updateNote).toHaveBeenCalledWith('acc-checking', 'Joint account');
  });

  it('rejects an empty append', async () => {
    const result = await handler({ id: 'cat-food', note: '', append: true });

    expect(result.isError).toBe(true);
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('rejects an unknown id instead of creating an orphan note', async () => {
    const result = await handler({ id: 'typo', note: '#template 100' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('No category or account found with id "typo"');
    expect(updateNote).not.toHaveBeenCalled();
  });

  it.each([{ id: 'cat-food', month: '2026-09' }, {}])('requires exactly one of id or month (%j)', async (target) => {
    const result = await handler({ ...target, note: 'x' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('exactly one of id');
    expect(updateNote).not.toHaveBeenCalled();
  });
});
