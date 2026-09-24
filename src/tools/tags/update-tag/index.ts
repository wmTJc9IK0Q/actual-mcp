// ----------------------------
// UPDATE TAG TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { getTags, updateTag } from '../../../api/tags.js';
import type { ToolInput } from '../../../types.js';
import {
  TAGS_IN_NOTES_HINT,
  TagColorSchema,
  TagNameSchema,
  assertTagNameFree,
  describeTag,
  requireTag,
} from '../shared.js';

const UpdateTagArgsSchema = z
  .object({
    id: z.string().min(1).describe('ID of the tag to update (from get-tags)'),
    tag: TagNameSchema.optional().describe('New tag name without "#". Does not rewrite existing transaction notes.'),
    color: TagColorSchema.nullable().optional().describe('New hex color "#RRGGBB", or null to clear it'),
    description: z.string().nullable().optional().describe('New description, or null to clear it'),
  })
  .refine((a) => a.tag !== undefined || a.color !== undefined || a.description !== undefined, {
    message: 'Provide at least one of tag, color, or description to update',
  });

type UpdateTagArgs = z.infer<typeof UpdateTagArgsSchema>;

export const schema = {
  name: 'update-tag',
  description:
    "Update a tag's name, color, and/or description; omitted fields are unchanged, null clears color/description. " +
    'Renaming only changes the tag entity: notes still containing the old "#name" are not rewritten, so edit ' +
    'them with update-transaction if needed. Fails if the new name is used by another tag. ' +
    TAGS_IN_NOTES_HINT,
  inputSchema: toJSONSchema(UpdateTagArgsSchema) as ToolInput,
};

export async function handler(args: UpdateTagArgs): Promise<CallToolResult> {
  try {
    const { id, ...fields } = UpdateTagArgsSchema.parse(args);
    const tags = await getTags();
    const before = requireTag(tags, id);
    if (fields.tag !== undefined) {
      assertTagNameFree(tags, fields.tag, 'Pick another name or delete that tag first.', id);
    }

    await updateTag(id, fields);

    const after = { ...before, ...fields };
    let text = `Updated tag ${describeTag(before)} → ${describeTag(after)}.`;
    if (after.tag !== before.tag) {
      text += ` Transaction notes still reference "#${before.tag}"; they were not rewritten.`;
    }
    return success(text);
  } catch (err) {
    return errorFromCatch(err);
  }
}
