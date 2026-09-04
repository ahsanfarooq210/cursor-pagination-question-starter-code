// Pagination stability harness. Start the server first, then: npm run check
//
// What it checks: a transaction that exists both when a scan starts and when it
// finishes must be returned EXACTLY ONCE while paging through the list. Rows
// created or deleted mid-scan may or may not show up — either is fine.

const BASE = process.env.BASE || 'http://localhost:3000';
const api = `${BASE}/accounts/acct_1/transactions`;
const LIMIT = 100;
const PAGE_CAP = 5000; // stops a broken "next page" from looping forever

// ===========================================================================
// THE SEAM — how the harness asks for a page. Change these three when you
// change the pagination contract; the rest of the file stays as it is.
// ===========================================================================
const firstQuery = () => `limit=${LIMIT}`;
const nextQuery = (res) => (res.hasMore ? `limit=${LIMIT}&page=${res.page + 1}` : null);
const itemsOf = (res) => res.data;
// ===========================================================================

const get = async (query) => {
  const res = await fetch(`${api}?${query}`);
  if (!res.ok) throw new Error(`GET ?${query} -> ${res.status}`);
  return res.json();
};

const allIds = async () => (await (await fetch(`${api}/ids`)).json()).ids;

const create = (n) =>
  Promise.all(
    Array.from({ length: n }, () =>
      fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 42, description: 'Concurrent write' }),
      })
    )
  );

const destroy = (ids) => Promise.all(ids.map((id) => fetch(`${api}/${id}`, { method: 'DELETE' })));

// Reads pages one after another, collecting ids into `seen`. Returns the query
// for the page it stopped at, or null if it reached the end of the list.
async function pageThrough(query, seen, maxPages, afterPage) {
  for (let page = 0; query && page < maxPages; page++) {
    const res = await get(query);
    seen.push(...itemsOf(res).map((t) => t.id));
    if (afterPage) await afterPage(page, seen.length);
    query = nextQuery(res);
  }
  return query;
}

function report(name, seen, before, after) {
  // Rows present at both ends of the scan. Those are the ones we can hold the
  // API to; anything created or deleted along the way is exempt.
  const stillThere = new Set(after);
  const stable = new Set(before.filter((id) => stillThere.has(id)));

  const timesSeen = new Map();
  for (const id of seen) timesSeen.set(id, (timesSeen.get(id) ?? 0) + 1);

  const duplicated = [...stable].filter((id) => timesSeen.get(id) > 1);
  const missing = [...stable].filter((id) => !timesSeen.has(id));
  const ok = duplicated.length === 0 && missing.length === 0;

  const count = (label, ids) =>
    console.log(`  ${label} : ${ids.length}${ids.length ? `   e.g. ${ids[0]}` : ''}`);

  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`  rows before / after : ${before.length} / ${after.length}`);
  console.log(`  rows returned       : ${seen.length}`);
  count('returned twice     ', duplicated);
  count('never returned     ', missing);
  return ok;
}

// --- scenario 1: writes keep landing while the client scrolls --------------
async function scrollWhileWriting() {
  const before = await allIds();
  const seen = [];

  await pageThrough(firstQuery(), seen, PAGE_CAP, async (page, position) => {
    if (page % 5 !== 0) return;
    if (page % 10 === 0) {
      await create(4); // new rows land at the top of the list
    } else {
      // rows the client already scrolled past are removed (a reversal, a cleanup job)
      const from = Math.max(0, position - 400);
      await destroy(before.slice(from, from + 6));
    }
  });

  return report('scrolling while other writes land', seen, before, await allIds());
}

// --- scenario 2: client drops off, comes back an hour later ----------------
async function resumeAfterDisconnect() {
  const before = await allIds();
  const seen = [];

  const resumeFrom = await pageThrough(firstQuery(), seen, 3);

  // The hour offline: plenty happens to the account while nobody is paging.
  await create(500);
  await destroy(before.slice(-200));

  // The client comes back and carries on from the query it had saved.
  await pageThrough(resumeFrom, seen, PAGE_CAP);

  return report('resume after being disconnected', seen, before, await allIds());
}

const passed = [await scrollWhileWriting(), await resumeAfterDisconnect()];
console.log('');
process.exit(passed.every(Boolean) ? 0 : 1);
