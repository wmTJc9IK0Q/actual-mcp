// ----------------------------
// NOTES - SHARED TARGET RESOLUTION
// ----------------------------

import { z } from 'zod';
import { getAccounts, getCategories } from '../../actual-api.js';
import { OptionalMonthSchema } from '../../core/input/validators.js';

/** Target fields shared by the note tools: exactly one of `id` or `month`. */
export const NoteTargetFields = {
  id: z
    .string()
    .min(1)
    .optional()
    .describe('ID of the category or account whose note to use. Provide either id or month, not both.'),
  month: OptionalMonthSchema.describe(
    "Budget month in YYYY-MM format, targeting that month's budget notes (where Actual logs budget " +
      'transfers/cover movements). Provide either id or month, not both.'
  ),
};

/** Raw target arguments accepted by the note tools. */
export interface NoteTargetArgs {
  id?: string;
  month?: string;
}

/** A validated note target: the Actual note ID plus a human-readable label. */
export interface NoteTarget {
  noteId: string;
  label: string;
}

/**
 * Resolve the tool's target arguments to an Actual note ID.
 * Months map to `budget-YYYY-MM`; IDs must belong to an existing category or account.
 *
 * @param args - Tool arguments containing exactly one of `id` or `month`
 * @returns The note ID and a label describing the target
 * @throws When both or neither target is given, or the ID matches no category or account
 */
export async function resolveNoteTarget({ id, month }: NoteTargetArgs): Promise<NoteTarget> {
  if ((id === undefined) === (month === undefined)) {
    throw new Error('Provide exactly one of id (category or account ID) or month (YYYY-MM)');
  }
  if (month !== undefined) {
    return { noteId: `budget-${month}`, label: `budget month ${month}` };
  }

  // Reason: Actual stores notes by bare ID with no foreign key, so saving a note for a
  // mistyped ID silently creates an orphan. Only accept IDs of real entities.
  const [categories, accounts] = await Promise.all([getCategories(), getAccounts()]);
  const category = categories.find((c) => c.id === id);
  if (category) {
    return { noteId: category.id, label: `category "${category.name}"` };
  }
  const account = accounts.find((a) => a.id === id);
  if (account) {
    return { noteId: account.id, label: `account "${account.name}"` };
  }
  throw new Error(`No category or account found with id "${id}"`);
}
