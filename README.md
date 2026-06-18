# Finance Aggregator

A fast, lightweight, **personal-use-only** finance app. Prioritizes balance
aggregation across multiple player identities and entities (personal/business),
with debt due dates, manually-valued points/miles, and future-dated manual
transactions for balance projection. Runs locally; financial tokens never leave
your machine.

Stack: Next.js 16 (App Router) · Prisma 7 + SQLite (better-sqlite3 driver adapter)
· Plaid · TypeScript. See [the plan](../.claude) for the full design and the
Phase B roadmap (money-movement rules engine + rule-based points earning).

## Setup

1. **Configure `.env`** (already gitignored). An `APP_ENCRYPTION_KEY` was generated
   for you. Add your Plaid keys (sandbox to start) from
   <https://dashboard.plaid.com> → Team Settings → Keys:

   ```
   PLAID_CLIENT_ID="..."
   PLAID_SECRET="..."
   PLAID_ENV="sandbox"
   ```

2. **Database** (already created + seeded with players P1–P4):

   ```bash
   npx prisma migrate dev     # apply schema
   npx prisma db seed         # seed P1–P4 (idempotent)
   ```

3. **Run:**

   ```bash
   npm run dev                # http://localhost:3000
   ```

## Using it (Plaid Sandbox)

- **Accounts → Connect institution**: pick a player + entity, then in Plaid Link
  use any sandbox institution with credentials `user_good` / `pass_good`. Multiple
  logins per player are supported (e.g. tag one Citi login `personal`, another
  `business`).
- **Sync** is per-connection; failures (e.g. `ITEM_LOGIN_REQUIRED`) show inline with
  a **Re-authenticate** action (Plaid Link update mode).
- **Manual / future-dated entries**: positive = inflow, negative = outflow.
  Future-dated entries only affect the projected balance until their date arrives.
- **Points**: enter balances + a per-point valuation; cash value rolls into net worth.

## Project layout

```
app/            UI pages + /app/api route handlers
lib/            plaid client, crypto (token encryption), db (Prisma singleton),
                sync (per-Item), networth (aggregation + projection)
components/     client components (Plaid Link, forms, sync/delete buttons)
prisma/         schema.prisma, seed.ts, migrations
```

## Notes

- Plaid does **not** expose reward points or per-transaction rail/network — points
  are manual, and rail is set per-account (used by Phase B points-earning rules).
- Prisma 7 guards destructive CLI commands (e.g. `migrate reset`) behind explicit
  consent; to wipe local data, delete rows via the app or a small client script.
