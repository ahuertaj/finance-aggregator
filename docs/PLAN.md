# Personal Finance Aggregator — Implementation Plan

## Context

Off-the-shelf aggregators (Monarch, etc.) don't align with how this user wants to
model their finances. The goal is a **fast, lightweight, personal-use-only** app that
prioritizes **balance aggregation across multiple identities** over transaction
categorization, with first-class support for debt due dates, manually-valued
alternative currencies (points/miles), and future-dated manual transactions for
balance projection. Plaid coverage of the relevant institutions is confirmed.

The **eventual** goal extends beyond monitoring to **tracking money movement between
entities** via a rules engine — e.g. a Plaid-visible "Wise load" (with a fee) should
be deduced as funding an *unmonitored* Wise balance by `amount − fee`, with a later
Wise deposit adjusting that balance; and **points-earning %s** that depend on a
transaction's source, destination, and rail. These are designed-for now, built later.

**Decisions locked with the user:**
- Stack: **TypeScript / Node**, end-to-end. Interface: **local web dashboard**.
  Hosting: **local-only, manual sync**; access tokens never leave the machine.
- **Per-connection** manual sync with **transparent refresh-failure reporting**.
- Must support **multiple credential sets per (player, entity)** — e.g. Citi requires
  separate business vs. personal logins.
- **Entity is a tag on accounts** (personal/business, extensible) — no separate entity
  layer. Money-movement rolls up by `(player, entity)`.
- Rules engine (transfer deduction + points earning): **schema-ready now, built later**.
- Points: **both** rule-based auto-accrual (later) **and** manual balance entry
  (MVP, the reconciling ground truth).

## Recommended architecture

A **single Next.js (App Router) app** + **SQLite via Prisma**:
- One TS codebase for UI *and* server logic (API route handlers) — no separate server.
- Plaid secret + access tokens used only in server-side `lib/` / route handlers,
  never shipped to the browser.
- SQLite = zero-ops, single-file, ideal for a fast single-user local tool; Prisma
  gives typed queries + migrations. Bind to `127.0.0.1`.

**Libraries:** `plaid` (Node SDK, server-side), `react-plaid-link` (Link UI),
`prisma` + `@prisma/client`, `recharts` (charts), `zod` (route-handler validation).
Keep the dependency surface minimal — "fast and lightweight" is a primary constraint.

## Data model (Prisma — `prisma/schema.prisma`)

Shape: **Player → Item (credential set) → Account → append-only snapshots**, with an
`entity` *tag* on Items/Accounts and rail/rules fields present from the start.

- **Player** — `id`, `label` (P1–P4), `name`. Seeded with the four players.
- **Item** — one Plaid login / **credential set**. `playerId`, `entity` (default tag
  inherited by its accounts, e.g. `business` for a Citi business login), `plaidItemId`,
  `accessTokenEnc` (AES-256-GCM), `institutionName/Id`, `transactionsCursor`,
  plus **sync-status fields**: `lastSyncAt`, `lastSyncStatus`
  (ok | error | login_required), `lastSyncError`. Multiple Items per player are
  allowed, **including multiple at the same institution** (Citi personal + business).
- **Account** — `itemId` (nullable for manual accounts), `playerId`,
  `entity` (tag; inherits Item default, per-account overridable), `plaidAccountId`
  (nullable), `name`, `officialName`, `type`, `subtype`, `mask`, `isManual`,
  `isMonitored` (false for Wise-style unmonitored balances), `isActive`, and
  **`rail`/`network`** (visa | mastercard | amex | discover | ach | wire | internal |
  other) — the basis for rail-aware points rules, since Plaid does not expose rail
  per transaction.
- **BalanceSnapshot** — `accountId`, `current`, `available`, `limit`,
  `isoCurrencyCode`, `capturedAt`. **Append-only** (one row/account/sync → history).
- **Liability** — `accountId`, `kind` (credit | student | mortgage),
  `nextPaymentDueDate`, `minimumPaymentAmount`, `lastPaymentDate/Amount`,
  `lastStatementBalance`, `aprPercentage`, `capturedAt`. From `/liabilities/get`.
- **ManualTransaction** — `accountId` (nullable), `playerId`, `entity`, `amount`,
  `date` (**may be future**), `description`, `category`, `source` (user | inferred),
  `isRecurring`, `recurrenceRule`. Rule-inferred entries (e.g. Wise loads) are written
  here with `source = inferred`.
- **PointsProgram** — `playerId`, `name` (e.g. "Amex MR"), `accountId` (optional).
- **PointsBalance** — `programId`, `balance`, `source` (manual | accrued), `capturedAt`.
- **PointsValuation** — `programId`, `centsPerPoint`, `effectiveDate` (latest wins).

**Schema-ready-for-later tables (created now, exercised in Phase B):**
- **Transaction** — `accountId`, `plaidTransactionId`, `amount`, `date`, `name`,
  `merchantName`, `category` (Plaid PFC), `pending`, `paymentChannel`,
  `internalTransferGroupId` (nullable; links matched transfer legs so net worth
  doesn't double-count), `excludeFromSpending`.
- **Rule** — `type` (transfer_inference | points_earning | categorization),
  `priority`, `enabled`, `matchJson` (conditions: source account/rail/entity,
  destination, category, merchant, amount predicates), `actionJson` (e.g. "post an
  inferred `internal` entry to account X = `amount − fee`"; "accrue points to program
  P at rate R"). Generic JSON-driven so new rules need no schema change.
- **PointsRule** (or a `points_earning` `Rule`) — `programId`, `multiplier`
  (pts per $), match conditions incl. `rail`, `category`, `source`/`destination`;
  `excludesTransfers` (so ACH transfers never earn).

## How each requirement maps

| Requirement | Implementation | Phase |
|---|---|---|
| Multiple identities (P1–P4) | `Player`; everything carries `playerId`. | A |
| Multiple credentials per (player, entity) | Multiple `Item`s per player, incl. same institution; `entity` tag distinguishes Citi business vs personal logins. | A |
| Balance aggregation (primary) | `/accounts/balance/get` → `BalanceSnapshot`; `lib/networth.ts` sums latest snapshots (liabilities negative) + manual accounts + points cash-value, grouped by player **and by entity tag**. | A |
| Per-connection sync + failure transparency | Each `Item` synced independently; status/last-error stored on the Item; UI shows per-connection badges + single-connection retry + Link **update mode** re-auth. | A |
| Debt due dates | `/liabilities/get` → `Liability`; due-date widget + Debt page sorted by soonest. | A |
| Points / alt currencies (manual) | `PointsProgram` + manual `PointsBalance` + user-set `PointsValuation`; cash value folded into net worth. | A |
| Future-dated manual transactions | `ManualTransaction.date` accepts future; `lib/networth.ts` computes current-vs-projected balance to a target date. | A |
| Money movement between entities | `Rule` (transfer_inference) over synced `Transaction`s: matches transfer legs (`internalTransferGroupId`), posts inferred `internal` entries to unmonitored accounts net of fee (Wise example), reports flows by `(player, entity)`. | B |
| Rail/source/destination-aware points earning | `PointsRule`/`points_earning` `Rule` evaluated against transactions using the **account's `rail`** + category + source/destination; `excludesTransfers` for ACH. Auto-accrues `PointsBalance(source=accrued)`; manual entries reconcile drift. | B |

## Plaid specifics

- Build against **Sandbox** first (`user_good` / `pass_good`). Plaid retired the old
  "Development" tier — go live via **Production** access (application/approval; per-item
  cost is negligible at single-user scale).
- Link token products: `auth`, `balance`, `liabilities` (add `transactions` in Phase B).
- One **Item per login**; tag each Item's `entity` at link time.
- **Reward points are not exposed** by Plaid (→ manual + rule-accrual).
- **Rail is not exposed** per transaction (→ derived from the `Account.rail` you set).
- Item error states (e.g. `ITEM_LOGIN_REQUIRED`) drive the failure-transparency UI and
  a Link **update-mode** re-auth flow.

## Project structure

```
app/
  page.tsx                 # Dashboard: net worth by player + entity + combined, due-date widget, projection
  accounts/page.tsx        # Accounts; Plaid Link to add a credential set; set player/entity/rail; per-connection sync status
  debt/page.tsx            # Liabilities + due dates
  points/page.tsx          # Programs, balances, valuations
  manual/page.tsx          # Manual + future-dated transactions
  rules/page.tsx           # (Phase B) author transfer/points rules
  api/
    plaid/link-token/route.ts   # create Link token (incl. update mode)
    plaid/exchange/route.ts     # public_token -> access_token; create Item/Accounts
    sync/[itemId]/route.ts      # per-connection sync: balances + liabilities (+ transactions in B)
    manual/route.ts             # CRUD manual txns
    points/route.ts             # CRUD programs/balances/valuations
    rules/route.ts              # (Phase B) CRUD + dry-run rules
lib/
  plaid.ts        # configured Plaid client (server-only)
  crypto.ts       # AES-256-GCM encrypt/decrypt of access tokens
  db.ts           # Prisma client singleton
  sync.ts         # per-Item sync orchestration + status capture
  networth.ts     # aggregation + projection (by player, by entity, combined)
  rules.ts        # (Phase B) rule evaluation: transfer inference + points accrual
prisma/schema.prisma
prisma/seed.ts    # seed Players P1–P4
```

## Security (local-only posture)

- `.env` (gitignored): `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`,
  `APP_ENCRYPTION_KEY`.
- Access tokens **encrypted at rest** (AES-256-GCM, `lib/crypto.ts`); decrypted only
  in memory during sync.
- SQLite db + `.env` gitignored; server bound to `127.0.0.1`; Plaid secret confined to
  `lib/` / route handlers.

## Build phases

**Phase A — MVP (fast, lightweight monitoring):**
1. Scaffold Next.js + Prisma + SQLite; define the **full** schema (incl. Phase-B
   tables); seed Players P1–P4.
2. `lib/plaid.ts`, `lib/crypto.ts`; Plaid Link flow storing encrypted Items + Accounts,
   tagged with player/entity/rail (Sandbox).
3. Per-connection sync (`lib/sync.ts`): balances → snapshots, liabilities; capture
   `lastSyncStatus`/`lastSyncError` per Item.
4. Dashboard aggregation (`lib/networth.ts`): net worth by player, by entity, combined;
   net-worth-over-time from snapshots.
5. Debt/due-dates page + widget.
6. Manual + future-dated transactions; projected-balance view.
7. Manual points programs, balances, valuations → cash value in net worth.
8. Per-connection status UI + Link update-mode re-auth.

**Phase B — money movement & earning (designed-for now):**
9. Plaid `/transactions/sync` into `Transaction`.
10. Rules engine (`lib/rules.ts`): transfer inference incl. Wise/fee deduction +
    internal-transfer matching; money-movement-by-entity reporting; rule-authoring UI
    with dry-run preview.
11. Rule-based points earning (rail/source/destination/category aware,
    transfer-excluding) with manual reconciliation.
12. Optional lightweight categorization (LLM pass over transactions).
13. Production access + secret/encryption hardening before connecting real accounts.

## Verification

End-to-end in **Sandbox** (Phase A):
1. `npx prisma migrate dev` + seed → 4 Players exist.
2. Link a sandbox institution (`user_good`/`pass_good`) to P1 with `entity=personal`;
   confirm encrypted `Item` + `Account` rows; link a second Item at the *same*
   institution tagged `business` to confirm multi-credential support.
3. Per-connection **Sync** → `BalanceSnapshot` + `Liability` rows populate; force/observe
   an error state and confirm the connection shows a clear failure + retry.
4. Dashboard shows P1 net worth split by entity and a due-date for the sandbox liability.
5. Add a **future-dated** manual transaction → current vs. projected balance differs by
   that amount.
6. Add a `PointsProgram` + balance + valuation (e.g. 1.5¢/pt) → cash value in net worth.
7. Link a second institution to P2 → per-player, per-entity, and combined totals.

Phase B verification (later): seed a Wise-style "load" transaction with a fee, confirm
the rule posts an inferred `internal` entry of `amount − fee` to the unmonitored Wise
account and the leg pair is excluded from spending; configure a points rule and confirm
accrual fires on a card-rail purchase but **not** on an ACH transfer.

## Open considerations (non-blocking)

- Recurring manual transactions (`recurrenceRule`) — start one-off, expand later.
- Transfer-matching heuristics (amount/date windows) will need tuning; the dry-run
  preview de-risks this.
- Fee modeling for Wise-style loads (fixed vs. %) should be expressible in `actionJson`.
