// ----------------------------
// UPDATE NOTE TOOL
// ----------------------------

import { z, toJSONSchema } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { success, errorFromCatch } from '../../../utils/response.js';
import { getNote, updateNote } from '../../../api/notes.js';
import type { ToolInput } from '../../../types.js';
import { NoteTargetFields, resolveNoteTarget } from '../shared.js';

const UpdateNoteArgsSchema = z.object({
  ...NoteTargetFields,
  note: z.string().describe('Note text. Replaces the whole note unless append is true. An empty string clears it.'),
  append: z
    .boolean()
    .optional()
    .describe('If true, add the text on a new line after the existing note instead of replacing it.'),
});

type UpdateNoteArgs = z.infer<typeof UpdateNoteArgsSchema>;

export const schema = {
  name: 'update-note',
  description:
    'Set the note on a category or account (by id), or the budget notes for a month (by month, YYYY-MM). ' +
    'Replaces the whole note by default; set append to add a new line instead. Provide exactly one of id or month. ' +
    'Budget templates live in category notes, one per line, with amounts in whole currency units (not cents), e.g. ' +
    "'#template 100' (budget 100 every month), '#template up to 200', '#template 500 by 2026-12', " +
    "'#template-2 50' (priority 2), or '#goal 1000'. Apply them with the budget template tools.",
  inputSchema: toJSONSchema(UpdateNoteArgsSchema) as ToolInput,
};

export async function handler(args: UpdateNoteArgs): Promise<CallToolResult> {
  try {
    const { note, append = false, ...targetArgs } = UpdateNoteArgsSchema.parse(args);
    if (append && note.length === 0) {
      throw new Error('note must not be empty when append is true');
    }
    const target = await resolveNoteTarget(targetArgs);

    let newNote = note;
    if (append) {
      const existing = (await getNote(target.noteId)) ?? '';
      // Reason: avoid a blank line when the existing note already ends with a newline.
      const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
      newNote = `${existing}${separator}${note}`;
    }

    await updateNote(target.noteId, newNote);

    if (newNote === '') {
      return success(`Cleared note for ${target.label}.`);
    }
    return success(`${append ? 'Appended to' : 'Updated'} note for ${target.label}. Note is now:\n${newNote}`);
  } catch (err) {
    return errorFromCatch(err);
  }
}
