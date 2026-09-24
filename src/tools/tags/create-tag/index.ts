// ----------------------------
// CREATE TAG TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { createTag, getTags } from '../../../api/tags.js';
import type { ToolInput } from '../../../types.js';
import { TAGS_IN_NOTES_HINT, TagColorSchema, TagNameSchema, assertTagNameFree, describeTag } from '../shared.js';

const CreateTagArgsSchema = z.object({
  tag: TagNameSchema,
  color: TagColorSchema.optional(),
  description: z.string().optional().describe('Optional description shown for the tag'),
});

type CreateTagArgs = z.infer<typeof CreateTagArgsSchema>;

export const schema = {
  name: 'create-tag',
  description:
    'Create a tag with an optional color and description. Fails if a tag with the same name already exists ' +
    '(names are case-sensitive); use update-tag to change it. Recreating the name of a deleted tag restores ' +
    'that tag. ' +
    TAGS_IN_NOTES_HINT,
  inputSchema: toJSONSchema(CreateTagArgsSchema) as ToolInput,
};

export async function handler(args: CreateTagArgs): Promise<CallToolResult> {
  try {
    const { tag, color = null, description = null } = CreateTagArgsSchema.parse(args);
    // Reason: Actual's createTag upserts by name and would wipe the existing tag's color/description.
    assertTagNameFree(await getTags(), tag, 'Use update-tag to change it.');

    const id = await createTag({ tag, color, description });
    return success(
      `Created tag ${describeTag({ tag, color, description })} with id ${id}. ` +
        `Tag a transaction by adding "#${tag}" to its notes.`
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
