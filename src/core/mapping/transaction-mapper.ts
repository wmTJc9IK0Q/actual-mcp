// Shared transaction mapping logic
import type { Transaction } from '../types/domain.js';

/**
 * Display-only sentinel category label for split parent transactions.
 *
 * # Reason: A split parent has no category of its own (its child splits carry
 * the categories). Reporting it as "(Uncategorized)" would make the agent think
 * the transaction is unassigned. This label is display-only and is never sent
 * to the Actual backend.
 */
export const SPLIT_CATEGORY_LABEL = '**SPLIT';

/**
 * Display-only sentinel category label for transfer transactions.
 *
 * # Reason: Transfers move money between accounts and are never categorized by
 * design. Reporting a transfer as "(Uncategorized)" would make the agent think
 * the transaction is unassigned. This label is display-only and is never sent
 * to the Actual backend.
 */
export const TRANSFER_CATEGORY_LABEL = '**TRANSFER';

/**
 * Returns a virtual sentinel category label for a transaction that structurally
 * cannot carry a real category, or null when the caller should resolve the real
 * (or absent) category itself.
 *
 * A transaction is never both a transfer and a split parent; the transfer check
 * runs first so a transfer always surfaces as `**TRANSFER`.
 *
 * @param transaction - The transaction to classify
 * @returns `**TRANSFER` for a transfer, `**SPLIT` for a split parent, or null otherwise
 */
export function displayCategoryLabel(transaction: Transaction): string | null {
  if (transaction.transfer_id) return TRANSFER_CATEGORY_LABEL;
  if (transaction.is_parent) return SPLIT_CATEGORY_LABEL;
  return null;
}
