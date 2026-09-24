// ----------------------------
// TAG TOOL HELPERS
// ----------------------------

import { z } from 'zod';
import type { APITagEntity } from '@actual-app/api/models';

/**
 * How Actual applies tags, shared by every tag tool description.
 * Reason: Actual has no tag-to-transaction link table; tags are parsed from transaction notes
 * with /(?<!#)#([^#\s]+)/ (see core `tags-discover` and the `hasTags` rule condition).
 */
export const TAGS_IN_NOTES_HINT =
  'In Actual, a transaction is tagged by writing "#name" in its notes (e.g. "Dinner #vacation"); use ' +
  'update-transaction to edit notes. A tag ends at whitespace or another "#", and "##name" is an escaped, ' +
  'non-tag literal. Tag entities only store display metadata (color, description) and never change notes.';

/** Tag name as Actual parses it from notes: no whitespace and no `#`, case-sensitive. */
export const TagNameSchema = z
  .string()
  .min(1)
  .regex(/^[^#\s]+$/, 'Tag names cannot contain whitespace or "#" (omit the leading "#")')
  .describe('Tag name without the leading "#", e.g. "vacation". No whitespace or "#"; case-sensitive.');

/** Hex color in the `#RRGGBB` form Actual's tag color picker stores. */
export const TagColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex color like "#1976D2"')
  .describe('Display color as hex "#RRGGBB", e.g. "#1976D2"');

/**
 * Find a live tag by ID.
 *
 * @throws Error naming the ID when no live tag has it (Actual would silently no-op)
 */
export function requireTag(tags: APITagEntity[], id: string): APITagEntity {
  const tag = tags.find((t) => t.id === id);
  if (!tag) throw new Error(`Tag not found: ${id}. Use get-tags to list tag IDs.`);
  return tag;
}

/**
 * Throw when another live tag already uses `name` (exact, case-sensitive match, like Actual's UNIQUE column).
 *
 * @param tags - Current live tags
 * @param name - Proposed tag name
 * @param hint - Guidance appended to the error
 * @param exceptId - Tag allowed to hold the name (the one being renamed)
 */
export function assertTagNameFree(tags: APITagEntity[], name: string, hint: string, exceptId?: string): void {
  const existing = tags.find((t) => t.tag === name && t.id !== exceptId);
  if (existing) throw new Error(`Tag "${name}" already exists (id ${existing.id}). ${hint}`);
}

/** Render a tag for tool output, e.g. `#vacation (color #1976D2, description "Trips")`. */
export function describeTag(tag: Omit<APITagEntity, 'id'>): string {
  const details = [`color ${tag.color ?? 'none'}`, `description ${tag.description ? `"${tag.description}"` : 'none'}`];
  return `#${tag.tag} (${details.join(', ')})`;
}
