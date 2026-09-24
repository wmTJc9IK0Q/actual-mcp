// ----------------------------
// ACTUAL API - NOTES
// ----------------------------

import * as api from '@actual-app/api';
import { initActualApi } from '../actual-api.js';

/**
 * Read the note attached to an entity (category, account, or `budget-YYYY-MM` month).
 *
 * @param id - Note ID, which is the ID of the entity the note belongs to
 * @returns The note text, or null when no note has been saved for that ID
 */
export async function getNote(id: string): Promise<string | null> {
  await initActualApi();
  const note = await api.getNote(id);
  return note?.note ?? null;
}

/**
 * Replace the note attached to an entity, creating it if it does not exist.
 *
 * @param id - Note ID, which is the ID of the entity the note belongs to
 * @param note - Full note text to store
 */
export async function updateNote(id: string, note: string): Promise<void> {
  await initActualApi();
  await api.updateNote(id, note);
}
