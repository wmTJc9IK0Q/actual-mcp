import type { APIScheduleEntity } from '@actual-app/core/server/api-models';
import type { APIAccountEntity, APIPayeeEntity } from '@actual-app/api/models';

/** Accounts returned by the mocked `getAccounts`. */
export const accounts: APIAccountEntity[] = [
  { id: 'acct-checking', name: 'Checking', offbudget: false, closed: false },
];

/** Payees returned by the mocked `getPayees`. */
export const payees: APIPayeeEntity[] = [{ id: 'payee-landlord', name: 'Landlord' }];

/**
 * Build a schedule as returned by Actual's `getSchedules`, defaulting to a monthly rent payment.
 *
 * @param overrides - Fields to replace
 */
export function schedule(overrides: Partial<APIScheduleEntity> = {}): APIScheduleEntity {
  return {
    id: 'sched-rent',
    name: 'Rent',
    rule: 'rule-rent',
    next_date: '2026-10-01',
    completed: false,
    posts_transaction: false,
    payee: 'payee-landlord',
    account: 'acct-checking',
    amount: -120000,
    amountOp: 'is',
    date: { frequency: 'monthly', interval: 1, start: '2026-09-01', endMode: 'never' },
    ...overrides,
  };
}
