// ----------------------------
// ACTUAL API - SCHEDULES
// ----------------------------

import * as api from '@actual-app/api';
import type { APIScheduleEntity } from '@actual-app/core/server/api-models';
import type { RecurConfig, RuleConditionEntity } from '@actual-app/core/types/models';
import { getInternalSend, initActualApi } from '../actual-api.js';

/** Low/high bounds (cents) of an `isbetween` schedule amount. */
export interface AmountRange {
  num1: number;
  num2: number;
}

/** Exact (`is`) or approximate (`isapprox`, ±7.5%) schedule amount in cents. */
export interface SingleScheduleAmount {
  op: 'is' | 'isapprox';
  value: number;
}

/** Schedule amount that matches anything between two bounds (cents). */
export interface RangeScheduleAmount {
  op: 'isbetween';
  value: AmountRange;
}

/** A schedule's amount condition: the operator decides the shape of the value. */
export type ScheduleAmount = SingleScheduleAmount | RangeScheduleAmount;

/** Fields for a new schedule; negative amounts are payments, positive are deposits. */
export interface NewSchedule {
  name?: string;
  postsTransaction: boolean;
  payeeId?: string;
  accountId?: string;
  amount: ScheduleAmount;
  /** One-time date (YYYY-MM-DD) or recurrence config. */
  date: string | RecurConfig;
}

/**
 * List all schedules (ensures API is initialized).
 */
export async function getSchedules(): Promise<APIScheduleEntity[]> {
  await initActualApi();
  return api.getSchedules();
}

/**
 * Create a schedule and its underlying rule.
 *
 * Reason: the public `api.createSchedule` stringifies missing payee/account IDs into
 * `"undefined"` rule conditions, so this builds the rule conditions itself (like Actual's
 * UI) and only includes payee/account conditions when they are given.
 *
 * @param schedule - Schedule fields
 * @returns ID of the new schedule
 */
export async function createSchedule(schedule: NewSchedule): Promise<string> {
  const send = await getInternalSend();
  const conditions: RuleConditionEntity[] = [];
  if (schedule.payeeId) conditions.push({ op: 'is', field: 'payee', value: schedule.payeeId });
  if (schedule.accountId) conditions.push({ op: 'is', field: 'account', value: schedule.accountId });
  conditions.push({ op: 'isapprox', field: 'date', value: schedule.date });
  conditions.push(
    schedule.amount.op === 'isbetween'
      ? { op: 'isbetween', field: 'amount', value: schedule.amount.value }
      : { op: schedule.amount.op, field: 'amount', value: schedule.amount.value }
  );
  return send('schedule/create', {
    schedule: { name: schedule.name, posts_transaction: schedule.postsTransaction },
    conditions,
  });
}

/**
 * Update a schedule's fields (ensures API is initialized). Every key present in `fields` is applied,
 * so callers must omit (not set to undefined) fields they don't want to change.
 *
 * @param id - Schedule to update
 * @param fields - Fields to change
 * @param resetNextDate - Recompute the next date from today even if date/account didn't change
 */
export async function updateSchedule(
  id: string,
  fields: Partial<APIScheduleEntity>,
  resetNextDate?: boolean
): Promise<void> {
  if (Object.keys(fields).length === 0) {
    // Reason: the public API returns early without resetting when no field changes.
    if (!resetNextDate) return;
    const send = await getInternalSend();
    await send('schedule/update', { schedule: { id }, resetNextDate: true });
    return;
  }
  await initActualApi();
  await api.updateSchedule(id, fields, resetNextDate);
}

/**
 * Delete a schedule and its underlying rule (ensures API is initialized).
 * Actual silently no-ops for unknown IDs.
 *
 * @param id - Schedule to delete
 */
export async function deleteSchedule(id: string): Promise<void> {
  await initActualApi();
  return api.deleteSchedule(id);
}
