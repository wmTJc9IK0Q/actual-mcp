// ----------------------------
// ACTUAL API - PAYEES
// ----------------------------

import * as api from '@actual-app/api';
import type { RuleEntity } from '@actual-app/core/types/models';
import { initActualApi } from '../actual-api.js';

/**
 * Merge payees into a target payee (ensures API is initialized).
 * Actual remaps the merged payees' IDs to the target, so their transactions and rules
 * resolve to the target, then deletes the merged payees. Transfer payees are silently skipped.
 *
 * @param targetId - Payee that survives the merge
 * @param mergeIds - Payees folded into the target and deleted
 */
export async function mergePayees(targetId: string, mergeIds: string[]): Promise<void> {
  await initActualApi();
  return api.mergePayees(targetId, mergeIds);
}

/**
 * Get the rules whose conditions or actions reference a payee (ensures API is initialized).
 *
 * @param payeeId - Payee to look up
 * @returns Matching rules, ranked the way Actual applies them
 */
export async function getPayeeRules(payeeId: string): Promise<RuleEntity[]> {
  await initActualApi();
  return api.getPayeeRules(payeeId);
}
