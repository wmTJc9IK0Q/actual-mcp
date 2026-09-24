// ----------------------------
// ACTUAL API - TAGS
// ----------------------------

import * as api from '@actual-app/api';
import type { APITagEntity } from '@actual-app/api/models';
import { initActualApi } from '../actual-api.js';

/** Editable tag fields; `null` clears color/description. */
export type TagFields = Partial<Omit<APITagEntity, 'id'>>;

/**
 * List all live (non-deleted) tags, sorted by name (ensures API is initialized).
 */
export async function getTags(): Promise<APITagEntity[]> {
  await initActualApi();
  return api.getTags();
}

/**
 * Create a tag (ensures API is initialized).
 * Reason: Actual upserts by exact name — creating an existing or deleted name reuses that tag's ID and
 * overwrites its color/description — so callers must check for live duplicates first.
 *
 * @param tag - Tag name (without `#`), optional color and description
 * @returns ID of the created (or restored) tag
 */
export async function createTag(tag: Omit<APITagEntity, 'id'>): Promise<string> {
  await initActualApi();
  return api.createTag(tag);
}

/**
 * Update a tag's name, color, or description (ensures API is initialized).
 * Actual silently ignores unknown IDs, so callers must check existence first.
 *
 * @param id - Tag ID
 * @param fields - Fields to change
 * @throws Error with a readable message when the new name collides with another tag, including
 *   deleted tags, whose names stay reserved in Actual's database
 */
export async function updateTag(id: string, fields: TagFields): Promise<void> {
  await initActualApi();
  try {
    await api.updateTag(id, fields);
  } catch (err) {
    if (isDuplicateTagNameError(err)) {
      throw new Error(
        `Tag name "${fields.tag}" is already taken by a deleted tag. ` +
          'Use create-tag with that name to restore the deleted tag instead, or pick another name.'
      );
    }
    throw err;
  }
}

/**
 * Delete a tag (ensures API is initialized). Actual silently ignores unknown IDs.
 *
 * @param id - Tag ID
 */
export async function deleteTag(id: string): Promise<void> {
  await initActualApi();
  await api.deleteTag(id);
}

/**
 * Detect Actual's SyncError for a `tags.tag` UNIQUE violation.
 * Reason: Actual surfaces it as a generic `invalid-schema` SyncError whose SQLite message is nested in `meta`.
 */
function isDuplicateTagNameError(err: unknown): boolean {
  if (!(err instanceof Error) || !('meta' in err)) return false;
  return JSON.stringify(err.meta ?? null).includes('UNIQUE constraint failed: tags.tag');
}
