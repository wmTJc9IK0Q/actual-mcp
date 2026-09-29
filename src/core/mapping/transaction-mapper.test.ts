import { describe, it, expect } from 'vitest';
import { displayCategoryLabel, SPLIT_CATEGORY_LABEL, TRANSFER_CATEGORY_LABEL } from './transaction-mapper.js';
import type { Transaction } from '../types/domain.js';

function baseTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    account: 'acc-1',
    date: '2024-05-01',
    amount: -1000,
    ...overrides,
  };
}

describe('displayCategoryLabel', () => {
  it('labels split parents as **SPLIT', () => {
    expect(displayCategoryLabel(baseTransaction({ is_parent: true }))).toBe(SPLIT_CATEGORY_LABEL);
    expect(displayCategoryLabel(baseTransaction({ is_parent: true }))).toBe('**SPLIT');
  });

  it('labels transfers as **TRANSFER', () => {
    expect(displayCategoryLabel(baseTransaction({ transfer_id: 'tx-2' }))).toBe(TRANSFER_CATEGORY_LABEL);
    expect(displayCategoryLabel(baseTransaction({ transfer_id: 'tx-2' }))).toBe('**TRANSFER');
  });

  it('lets a categorized (split child) transaction keep its real category', () => {
    // A split child carries a real category and is neither a parent nor a transfer.
    const child = baseTransaction({ category: 'cat-1', category_name: 'Dining' });
    expect(displayCategoryLabel(child)).toBeNull();
  });

  it('returns null for a genuinely uncategorized transaction', () => {
    expect(displayCategoryLabel(baseTransaction({}))).toBeNull();
  });

  it('prefers **TRANSFER even if a transfer somehow carries a category', () => {
    const transfer = baseTransaction({ transfer_id: 'tx-2', category: 'cat-1', category_name: 'Dining' });
    expect(displayCategoryLabel(transfer)).toBe(TRANSFER_CATEGORY_LABEL);
  });

  it('prefers **SPLIT for a split parent even if it somehow carries a category', () => {
    const parent = baseTransaction({ is_parent: true, category: 'cat-1', category_name: 'Dining' });
    expect(displayCategoryLabel(parent)).toBe(SPLIT_CATEGORY_LABEL);
  });
});
