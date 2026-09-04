import express from 'express';
import { randomUUID } from 'node:crypto';
import { ORDER, clamp, seedTransactions } from './utils.js';

const PORT = Number(process.env.PORT || 3000);
const ACCOUNT_ID = 'acct_1';
const SEED_ROWS = Number(process.env.SEED_ROWS || 100_000);

// ---------------------------------------------------------------------------
// The "database": one array of transactions, always held in ORDER (see
// utils.js) — the order the list endpoint returns them in. In SQL:
//
//     SELECT * FROM transactions WHERE account_id = ?
//     ORDER BY created_at DESC, id DESC
//
// That is the only order rows are ever read in.
// ---------------------------------------------------------------------------
const transactions = seedTransactions(ACCOUNT_ID, SEED_ROWS);

function insert({ amount, description }) {
  const txn = {
    id: randomUUID(),
    accountId: ACCOUNT_ID,
    amount,
    description,
    createdAt: new Date().toISOString(),
  };
  const at = transactions.findIndex((row) => ORDER(txn, row) < 0);
  transactions.splice(at === -1 ? transactions.length : at, 0, txn);
  return txn;
}

function remove(id) {
  const at = transactions.findIndex((row) => row.id === id);
  if (at === -1) return false;
  transactions.splice(at, 1);
  return true;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

const base = '/accounts/:accountId/transactions';

// Only one account exists in this starter.
app.use(base, (req, res, next) => {
  if (req.params.accountId !== ACCOUNT_ID) {
    return res.status(404).json({ error: `no such account: ${req.params.accountId}` });
  }
  next();
});

// Helper for the test harness. Not something a real API would expose.
app.get(`${base}/ids`, (req, res) => {
  res.json({ ids: transactions.map((t) => t.id) });
});

// LIST — the endpoint in question.
app.get(base, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = clamp(Number(req.query.limit) || 25, 1, 100);
  const offset = (page - 1) * limit;

  res.json({
    data: transactions.slice(offset, offset + limit),
    page,
    limit,
    total: transactions.length,
    hasMore: offset + limit < transactions.length,
  });
});

// CREATE — stands in for other users and systems writing to the account.
app.post(base, (req, res) => {
  const txn = insert({
    amount: Number(req.body.amount ?? 1),
    description: String(req.body.description ?? 'Manual'),
  });
  res.status(201).json(txn);
});

app.delete(`${base}/:txnId`, (req, res) => {
  if (!remove(req.params.txnId)) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: req.params.txnId });
});

app.listen(PORT, () => {
  console.log(`seeded ${transactions.length} transactions for ${ACCOUNT_ID}`);
  console.log(`listening on http://localhost:${PORT}`);
  console.log(`try: curl 'http://localhost:${PORT}/accounts/${ACCOUNT_ID}/transactions?page=1&limit=5'`);
});
