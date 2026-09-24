import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { textContent } from '../../../utils/response.js';
import { schedule } from '../test-fixtures.js';

vi.mock('../../../api/schedules.js', () => ({
  getSchedules: vi.fn(),
  deleteSchedule: vi.fn(),
}));

import { deleteSchedule, getSchedules } from '../../../api/schedules.js';

describe('delete-schedule tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSchedules).mockResolvedValue([schedule(), schedule({ id: 'sched-unnamed', name: undefined })]);
  });

  it('deletes a schedule and names it in the confirmation', async () => {
    const result = await handler({ id: 'sched-rent' });

    expect(result.isError).toBeFalsy();
    expect(deleteSchedule).toHaveBeenCalledWith('sched-rent');
    expect(textContent(result.content[0])).toBe('Deleted schedule "Rent" (id: sched-rent).');
  });

  it('deletes an unnamed schedule', async () => {
    const result = await handler({ id: 'sched-unnamed' });

    expect(textContent(result.content[0])).toBe('Deleted schedule (unnamed) (id: sched-unnamed).');
  });

  it('rejects an unknown ID instead of silently succeeding', async () => {
    const result = await handler({ id: 'nope' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('Schedule not found: nope');
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it('surfaces errors from Actual', async () => {
    vi.mocked(deleteSchedule).mockRejectedValue(new Error('database is locked'));

    const result = await handler({ id: 'sched-rent' });

    expect(result.isError).toBe(true);
    expect(textContent(result.content[0])).toContain('database is locked');
  });
});
