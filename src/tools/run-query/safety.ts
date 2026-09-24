// ----------------------------
// RUN QUERY - LITERAL SAFETY
// ----------------------------

/**
 * Field names (last path segment) that ActualQL types as `id`, across every table reachable
 * from the queryable tables (see `@actual-app/core` `server/aql/schema`).
 */
const ID_FIELDS: Record<string, true> = {
  id: true,
  parent_id: true,
  account: true,
  category: true,
  payee: true,
  transfer_id: true,
  schedule: true,
  transfer_acct: true,
  group: true,
  rule: true,
  _payee: true,
  _account: true,
};

/**
 * Recursively find string literals that ActualQL would splice into SQL without escaping.
 *
 * @param node - Expression subtree
 * @param field - Nearest enclosing field name, if any
 * @param inOneof - Whether the subtree is the operand of `$oneof`
 * @returns The first unsafe string found, or null
 */
function findUnsafeLiteral(node: unknown, field: string | undefined, inOneof: boolean): string | null {
  if (typeof node === 'string') {
    const isIdField = field !== undefined && ID_FIELDS[field.slice(field.lastIndexOf('.') + 1)] === true;
    return node.includes("'") && (inOneof || isIdField) ? node : null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findUnsafeLiteral(item, field, inOneof);
      if (found !== null) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      let found: string | null;
      if (key === '$and' || key === '$or') {
        found = findUnsafeLiteral(value, undefined, false);
      } else if (key.startsWith('$')) {
        found = findUnsafeLiteral(value, field, inOneof || key === '$oneof');
      } else {
        found = findUnsafeLiteral(value, key, inOneof);
      }
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * Reject query expressions containing single quotes where ActualQL does not escape them.
 *
 * Reason: Actual's compiler escapes quotes in ordinary string literals but interpolates `id`-typed
 * comparisons and `$oneof` values verbatim, so a quote there yields broken (or injected) SQL.
 * Real IDs never contain quotes, so rejecting them costs nothing.
 *
 * @param expressions - Named query parts (filter, select, ...) to check
 * @throws Error naming the offending query part and value
 */
export function assertNoUnsafeLiterals(expressions: Record<string, unknown>): void {
  for (const [part, expr] of Object.entries(expressions)) {
    const unsafe = findUnsafeLiteral(expr, undefined, false);
    if (unsafe !== null) {
      throw new Error(
        `Unsupported value in ${part}: ${JSON.stringify(unsafe)}. Single quotes are not allowed in $oneof ` +
          'values or ID-field comparisons; use $like on a name field instead.'
      );
    }
  }
}
