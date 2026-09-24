// ----------------------------
// DELETE TAG TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { deleteTag, getTags } from '../../../api/tags.js';
import type { ToolInput } from '../../../types.js';
import { TAGS_IN_NOTES_HINT, requireTag } from '../shared.js';

const DeleteTagArgsSchema = z.object({
  id: z.string().min(1).describe('ID of the tag to delete (from get-tags)'),
});

type DeleteTagArgs = z.infer<typeof DeleteTagArgsSchema>;

export const schema = {
  name: 'delete-tag',
  description:
    'Delete a tag entity (its color and description). Transaction notes containing "#name" are not changed, ' +
    'so those transactions still carry the tag text; remove it from notes with update-transaction if needed. ' +
    TAGS_IN_NOTES_HINT,
  inputSchema: toJSONSchema(DeleteTagArgsSchema) as ToolInput,
};

export async function handler(args: DeleteTagArgs): Promise<CallToolResult> {
  try {
    const { id } = DeleteTagArgsSchema.parse(args);
    const tag = requireTag(await getTags(), id);

    await deleteTag(id);

    return success(`Deleted tag #${tag.tag} (id ${id}). Transaction notes containing "#${tag.tag}" were not changed.`);
  } catch (err) {
    return errorFromCatch(err);
  }
}
