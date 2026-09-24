import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';

vi.mock('../../../api/tags.js', () => ({
  getTags: vi.fn(),
}));

import { getTags } from '../../../api/tags.js';

describe('get-tags tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns every tag with its metadata', async () => {
    const tags = [
      { id: 't1', tag: 'groceries', color: '#689F38', description: 'Food shopping' },
      { id: 't2', tag: 'vacation', color: null, description: null },
    ];
    vi.mocked(getTags).mockResolvedValue(tags);

    const result = await handler();

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textContent(result.content[0]))).toEqual(tags);
  });

  it('returns an empty list when the budget has no tags', async () => {
    vi.mocked(getTags).mockResolvedValue([]);

    const result = await handler();

    expect(JSON.parse(textContent(result.content[0]))).toEqual([]);
  });

  it('reports API failures as errors', async () => {
    vi.mocked(getTags).mockRejectedValue(new Error('budget not loaded'));

    const result = await handler();

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('budget not loaded');
  });
});
