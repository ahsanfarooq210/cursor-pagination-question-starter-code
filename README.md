# Transactions pagination — starter

A small Express service with one list endpoint, seeded with 100,000 rows for
`acct_1`. Node 18+.

```bash
npm install
```
```bash
npm start
```
```bash
npm run check
```

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/accounts/:id/transactions?page=1&limit=25` | the list endpoint |
| `POST` | `/accounts/:id/transactions` | `{ amount, description }` — stands in for another writer |
| `DELETE` | `/accounts/:id/transactions/:txnId` | removes a row |
| `GET` | `/accounts/:id/transactions/ids` | harness helper: every id, in list order |

A transaction looks like:

```json
{ "id": "0b0e…-uuid", "accountId": "acct_1", "amount": 41.2,
  "description": "Coffee", "createdAt": "2024-01-02T17:31:33.355Z" }
```

Rows are read in one order only — newest first:
`ORDER BY created_at DESC, id DESC`.

## The files

- **`server.js`** — an Express app over an array of transactions. No database;
  the array *is* the table.
- **`utils.js`** — the sort order rows are kept in, a `clamp`, and the seed data
  generator.
- **`check.js`** — pages through the whole list while other writes land, and
  checks one thing: **a row that exists both when the scan starts and when it
  finishes must be returned exactly once.** Rows created or deleted mid-scan may
  or may not appear.
- The harness asks for pages through three functions at the top of `check.js`
  marked `THE SEAM`. If you change the pagination contract, update those three —
  nothing else in the harness needs to move.

`npm run check` fails against the code as shipped. It takes about a minute.

Other ports: `PORT=3777 npm start` and `BASE=http://localhost:3777 npm run check`.
