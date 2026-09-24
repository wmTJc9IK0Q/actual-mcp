import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../api/tags.js', () => ({
  getTags: vi.fn(),
  deleteTag: vi.fn(),
}));

import { deleteTag, getTags } from '../../../api/tags.js';

const groceries = { id: 't1', tag: 'groceries', color: '#689F38', description: null };

describe('delete-tag tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTags).mockResolvedValue([groceries]);
  });

  it('deletes the tag and notes that transaction notes are untouched', async () => {
    const result = await handler({ id: 't1' });

    expect(deleteTag).toHaveBeenCalledWith('t1');
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('Deleted tag #groceries');
    expect(text).toContain('were not changed');
  });

  it('rejects an unknown tag ID instead of silently doing nothing', async () => {
    const result = await handler({ id: 'nope' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Tag not found: nope');
    expect(deleteTag).not.toHaveBeenCalled();
  });

  it('reports API failures as errors', async () => {
    vi.mocked(deleteTag).mockRejectedValue(new Error('sync failed'));

    const result = await handler({ id: 't1' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('sync failed');
  });
});
