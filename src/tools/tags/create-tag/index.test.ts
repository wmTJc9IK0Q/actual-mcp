import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../api/tags.js', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
}));

import { createTag, getTags } from '../../../api/tags.js';

const groceries = { id: 't1', tag: 'groceries', color: '#689F38', description: 'Food shopping' };

describe('create-tag tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTags).mockResolvedValue([groceries]);
    vi.mocked(createTag).mockResolvedValue('t-new');
  });

  it('creates a tag and explains how to apply it', async () => {
    const result = await handler({ tag: 'vacation', color: '#1976D2', description: 'Trips' });

    expect(createTag).toHaveBeenCalledWith({ tag: 'vacation', color: '#1976D2', description: 'Trips' });
    expect(result.isError).toBeFalsy();
    const text = textContent(result.content[0]);
    expect(text).toContain('t-new');
    expect(text).toContain('"#vacation" to its notes');
  });

  it('stores missing color and description as null', async () => {
    await handler({ tag: 'vacation' });

    expect(createTag).toHaveBeenCalledWith({ tag: 'vacation', color: null, description: null });
  });

  it('allows a name differing only by case, as Actual does', async () => {
    const result = await handler({ tag: 'Groceries' });

    expect(result.isError).toBeFalsy();
    expect(createTag).toHaveBeenCalled();
  });

  it('rejects a duplicate name instead of overwriting the existing tag', async () => {
    const result = await handler({ tag: 'groceries' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('already exists (id t1)');
    expect(createTag).not.toHaveBeenCalled();
  });

  it.each(['has space', '#groceries', 'a#b', ''])('rejects invalid tag name %j', async (tag) => {
    const result = await handler({ tag });

    expect(result.isError).toBe(true);
    expect(createTag).not.toHaveBeenCalled();
  });

  it('rejects a non-hex color', async () => {
    const result = await handler({ tag: 'vacation', color: 'blue' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('#1976D2');
    expect(createTag).not.toHaveBeenCalled();
  });
});
