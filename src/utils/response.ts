// ----------------------------
// RESPONSE UTILITIES
// ----------------------------

import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';

/**
 * Standard MCP content item types (derived from CallToolResult to stay in sync with SDK)
 */
export type ContentItem = CallToolResult['content'][number];

/**
 * Text content item (most common type)
 */
export type TextContentItem = TextContent;

/**
 * Standard MCP response structure (compatible with CallToolResult)
 */
export type Response = CallToolResult;

/**
 * Create a successful plain text response
 * @param text - The text message
 * @returns A success response object with text content
 */
export function success(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Create a success response with structured content
 * @param content - Array of content items
 * @returns A success response object with provided content
 */
export function successWithContent(content: ContentItem): CallToolResult {
  return {
    content: [content],
  };
}

/**
 * Create a success response with JSON data
 * @param data - Any data object that can be JSON-stringified
 * @returns A success response with JSON data wrapped as a resource
 */
export function successWithJson<T>(data: T): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data),
      },
    ],
  };
}

/**
 * Create an error response
 * @param message - The error message
 * @returns An error response object
 */
export function error(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: `Error: ${message}` }],
  };
}

/**
 * JSON.stringify with cycle protection and bounded output, so attaching an
 * error's custom fields (e.g. `reason`, `meta`) can never blow up or flood.
 */
function safeStringify(value: unknown, maxLen = 1500): string {
  const seen = new WeakSet<object>();
  let out: string;
  try {
    out = JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val as object)) return '[Circular]';
        seen.add(val as object);
      }
      if (typeof val === 'string' && val.length > 500) return `${val.slice(0, 500)}…`;
      return val as unknown;
    });
  } catch {
    return String(value);
  }
  if (out === undefined) return String(value);
  return out.length > maxLen ? `${out.slice(0, maxLen)}…` : out;
}

/**
 * Build a human/agent-readable description of a thrown value, preserving the
 * detail a bare `err.message` throws away: the error name, any custom fields
 * (libraries like @actual-app/api attach `reason`, `meta.error`, `meta.query`),
 * the `cause` chain, and a short stack. Without this, an error whose `.message`
 * is empty renders as a useless bare "Error:".
 */
function describeError(err: unknown, depth = 0): string {
  if (depth > 4) return '…';

  if (err instanceof Error) {
    const name = err.name || 'Error';
    const msg = err.message && err.message.trim() ? err.message : '(no message)';
    const lines = [`${name}: ${msg}`];

    // Own enumerable props beyond the standard ones — where custom errors hide
    // the real reason (e.g. SyncError.reason, SyncError.meta.error.message).
    const extra: Record<string, unknown> = {};
    for (const key of Object.keys(err)) {
      if (key === 'stack' || key === 'message' || key === 'cause') continue;
      extra[key] = (err as unknown as Record<string, unknown>)[key];
    }
    if (Object.keys(extra).length > 0) {
      lines.push(`details: ${safeStringify(extra)}`);
    }

    const cause = (err as { cause?: unknown }).cause;
    if (cause != null) {
      lines.push(`caused by: ${describeError(cause, depth + 1)}`);
    }

    if (depth === 0 && typeof err.stack === 'string') {
      // First few stack frames locate the failure without flooding the reply.
      const frames = err.stack.split('\n').slice(1, 5).join('\n');
      if (frames.trim()) lines.push(frames);
    }

    return lines.join('\n');
  }

  if (typeof err === 'object' && err !== null) return safeStringify(err);
  return String(err);
}

/**
 * Create an error response from an Error object or any thrown value.
 * Surfaces full error detail (name, custom fields, cause chain, stack) so the
 * caller can actually diagnose the failure instead of seeing a bare "Error:".
 * @param err - The error object or value
 * @returns An error response object
 */
export function errorFromCatch(err: unknown): CallToolResult {
  return error(describeError(err));
}

/**
 * Extract text from a content item, narrowing the union type.
 * Throws if the item is not a text content item.
 *
 * @param item - A content item from a CallToolResult
 * @returns The text string from the content item
 */
export function textContent(item: ContentItem): string {
  if (item.type !== 'text') {
    throw new Error(`Expected text content, got ${item.type}`);
  }
  return item.text;
}
