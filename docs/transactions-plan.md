# Plan: Pull transactions (Phase B)

Deferred from the Phase A cleanup. Captured here so we can pick it up later
without re-deriving the design. Nothing below is implemented yet.

## What already exists

- `Transaction` model in [schema.prisma](../prisma/schema.prisma) with the fields
  we need: `plaidTransactionId` (unique), `amount`, `date`, `name`,
  `merchantName`, `category`, `pending`, `paymentChannel`,
  `internalTransferGroupId`, `excludeFromSpending`.
- `Item.transactionsCursor` — the cursor field for incremental sync.
- Link tokens already request `Products.Transactions`, so consent is in place
  for connections made after that change.

## Approach: `/transactions/sync` (cursor-based)

Plaid's `/transactions/sync` returns `added` / `modified` / `removed` since a
cursor, plus a `next_cursor` and `has_more`. It's the recommended replacement
for the older `/transactions/get` date-range polling.

1. **`syncTransactions(itemId)` in `lib/sync.ts`** — loop calling
   `plaid.transactionsSync({ access_token, cursor })` while `has_more`:
   - upsert `added` + `modified` by `plaidTransactionId`
   - delete `removed`
   - persist `next_cursor` to `Item.transactionsCursor` only after the full
     page loop succeeds (so a mid-loop failure replays cleanly).
2. **Wire into `syncItem`** — call after balances/liabilities. Keep it
   best-effort/non-fatal like liabilities, and skip inactive accounts.
3. **First sync** is a full backfill (null cursor). Plaid may return
   `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` — handle by restarting the
   loop from the last persisted cursor.
4. **Initial-load lag** — newly linked items may return few/no transactions for
   ~10–30s. Either accept it (next manual sync fills in) or subscribe to the
   `SYNC_UPDATES_AVAILABLE` webhook (needs a public URL — out of scope for a
   local app, revisit if we ever host it).

## UI

- New `/transactions` page: filter by player/account/date, search by name.
- Surface `pending`, category, and an "exclude from spending" toggle
  (`excludeFromSpending`) for transfers between own accounts.

## Open questions

- Internal-transfer detection (`internalTransferGroupId`): heuristic match on
  equal/opposite amounts across a player's accounts within a few days, vs.
  manual tagging. Lean manual first, add the heuristic later.
- Do transactions feed net-worth projection, or stay a read-only ledger? (Phase
  A projection uses manual entries; transactions could auto-suggest recurring
  ones — but that's a later step.)
