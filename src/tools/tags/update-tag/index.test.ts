import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../api/tags.js', () => ({
  getTags: vi.fn(),
  updateTag: vi.fn(),
}));

import { getTags, updateTag } from '../../../api/tags.js';

const groceries = { id: 't1', tag: 'groceries', color: '#689F38', description: 'Food shopping' };
const vacation = { id: 't2', tag: 'vacation', color: null, description: null };

describe('update-tag tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTags).mockResolvedValue([groceries, vacation]);
  });

  it('changes only the provided fields and reports before and after', async () => {
    const result = await handler({ id: 't1', color: '#1976D2' });

    expect(updateTag).toHaveBeenCalledWith('t1', { color: '#1976D2' });
    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).toContain(
      '#groceries (color #689F38, description "Food shopping") → #groceries (color #1976D2, description "Food shopping")'
    );
  });

  it('clears color and description with null', async () => {
    const result = await handler({ id: 't1', color: null, description: null });

    expect(updateTag).toHaveBeenCalledWith('t1', { color: null, description: null });
    expect(textContent(result.content[0])).toContain('→ #groceries (color none, description none)');
  });

  it('warns that renaming does not rewrite transaction notes', async () => {
    const result = await handler({ id: 't1', tag: 'food' });

    expect(updateTag).toHaveBeenCalledWith('t1', { tag: 'food' });
    expect(textContent(result.content[0])).toContain('still reference "#groceries"');
  });

  it('allows keeping the same name', async () => {
    const result = await handler({ id: 't1', tag: 'groceries', description: 'Weekly' });

    expect(result.isError).toBeFalsy();
    expect(textContent(result.content[0])).not.toContain('still reference');
  });

  it('rejects renaming onto another tag name', async () => {
    const result = await handler({ id: 't1', tag: 'vacation' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Tag "vacation" already exists (id t2)');
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('rejects an unknown tag ID instead of silently doing nothing', async () => {
    const result = await handler({ id: 'nope', color: '#1976D2' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Tag not found: nope');
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('rejects a call with nothing to change', async () => {
    const result = await handler({ id: 't1' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('at least one of');
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('rejects an invalid new name', async () => {
    const result = await handler({ id: 't1', tag: 'two words' });

    expect(result.isError).toBe(true);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('surfaces API failures such as a name reserved by a deleted tag', async () => {
    vi.mocked(updateTag).mockRejectedValue(new Error('Tag name "old" is already taken by a deleted tag.'));

    const result = await handler({ id: 't1', tag: 'old' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('already taken by a deleted tag');
  });
});
