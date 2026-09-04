import { randomUUID } from 'node:crypto';

// Compares two values so that the larger one sorts first.
export const desc = (x, y) => (x < y ? 1 : x > y ? -1 : 0);

// The one order transactions are ever read in: newest first, with the id
// breaking ties between rows written in the same millisecond. In SQL:
//
//     ORDER BY created_at DESC, id DESC
//
export const ORDER = (a, b) => desc(a.createdAt, b.createdAt) || desc(a.id, b.id);

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const MERCHANTS = ['Coffee', 'Rent', 'Payroll', 'Refund', 'Transfer', 'Groceries', 'Fuel'];

// Builds the starting dataset, in ORDER and ready to serve.
export function seedTransactions(accountId, count) {
  const rows = [];
  let time = Date.UTC(2024, 0, 1);
  for (let i = 0; i < count; i++) {
    // The clock only moves every few rows, so plenty of transactions share an
    // identical createdAt.
    if (i % 4 === 0) time += Math.floor(Math.random() * 3000);
    rows.push({
      id: randomUUID(),
      accountId,
      amount: Number(((Math.random() - 0.4) * 5000).toFixed(2)),
      description: MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)],
      createdAt: new Date(time).toISOString(),
    });
  }
  return rows.sort(ORDER);
}
