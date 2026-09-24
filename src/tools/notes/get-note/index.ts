// ----------------------------
// GET NOTE TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { getNote } from '../../../api/notes.js';
import type { ToolInput } from '../../../types.js';
import { NoteTargetFields, resolveNoteTarget } from '../shared.js';

const GetNoteArgsSchema = z.object(NoteTargetFields);

type GetNoteArgs = z.infer<typeof GetNoteArgsSchema>;

export const schema = {
  name: 'get-note',
  description:
    'Read the note attached to a category or account (by id), or the budget notes for a month (by month, YYYY-MM). ' +
    "Category notes hold budget template lines such as '#template 100'; month notes log budget transfers. " +
    'Provide exactly one of id or month.',
  inputSchema: toJSONSchema(GetNoteArgsSchema) as ToolInput,
};

export async function handler(args: GetNoteArgs): Promise<CallToolResult> {
  try {
    const target = await resolveNoteTarget(GetNoteArgsSchema.parse(args));
    const note = await getNote(target.noteId);
    if (!note) {
      return success(`No note exists for ${target.label}.`);
    }
    return success(`Note for ${target.label}:\n${note}`);
  } catch (err) {
    return errorFromCatch(err);
  }
}
