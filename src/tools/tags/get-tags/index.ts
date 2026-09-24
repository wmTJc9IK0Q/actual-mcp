// ----------------------------
// GET TAGS TOOL
// ----------------------------

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { successWithJson, errorFromCatch } from '../../../utils/response.js';
import { getTags } from '../../../api/tags.js';
import { TAGS_IN_NOTES_HINT } from '../shared.js';

export const schema = {
  name: 'get-tags',
  description:
    'List all tags with their id, tag name (without "#"), color, and description. ' +
    TAGS_IN_NOTES_HINT +
    ' Notes can use "#name" without a tag entity existing; the entity just adds color/description.',
  inputSchema: {
    type: 'object',
    description: 'This tool does not accept any arguments.',
    properties: {},
    additionalProperties: false,
  },
};

export async function handler(): Promise<CallToolResult> {
  try {
    return successWithJson(await getTags());
  } catch (err) {
    return errorFromCatch(err);
  }
}
