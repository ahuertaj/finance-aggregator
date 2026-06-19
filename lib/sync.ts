// Per-connection (per-Item) sync orchestration. Fetches balances + liabilities
// for one Plaid Item, writes append-only snapshots, and records sync status so
// the UI can show transparent per-connection failures.
import { plaid } from "./plaid";
import { prisma } from "./db";
import { decrypt } from "./crypto";
import { cleanName } from "./format";

export type SyncResult = {
  ok: boolean;
  status: "ok" | "error" | "login_required";
  error?: string;
  accounts?: number;
};

function toDate(d?: string | null): Date | null {
  return d ? new Date(d) : null;
}

/** Upsert the Plaid account row and append a balance snapshot. */
async function upsertAccountWithBalance(
  itemId: string,
  playerId: number,
  entity: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: any,
) {
  const acct = await prisma.account.upsert({
    where: { plaidAccountId: a.account_id },
    update: {
      name: cleanName(a.name),
      officialName: a.official_name ?? null,
      type: a.type ?? null,
      subtype: a.subtype ?? null,
      mask: a.mask ?? null,
    },
    create: {
      itemId,
      playerId,
      entity,
      plaidAccountId: a.account_id,
      name: cleanName(a.name),
      officialName: a.official_name ?? null,
      type: a.type ?? null,
      subtype: a.subtype ?? null,
      mask: a.mask ?? null,
    },
  });

  // Skip history for soft-removed accounts (the upsert leaves isActive untouched,
  // so a removed account stays removed across syncs and accumulates no snapshots).
  if (acct.isActive) {
    await prisma.balanceSnapshot.create({
      data: {
        accountId: acct.id,
        current: a.balances?.current ?? null,
        available: a.balances?.available ?? null,
        limit: a.balances?.limit ?? null,
        isoCurrencyCode: a.balances?.iso_currency_code ?? null,
      },
    });
  }
  return acct;
}

/** Best-effort liabilities pull. Many items don't support it — failure is non-fatal. */
async function syncLiabilities(accessToken: string) {
  let liab;
  try {
    const resp = await plaid.liabilitiesGet({ access_token: accessToken });
    liab = resp.data.liabilities;
  } catch {
    return; // product not available for this item — skip silently
  }

  const byPlaidId = async (plaidAccountId?: string | null) =>
    plaidAccountId
      ? prisma.account.findUnique({ where: { plaidAccountId } })
      : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (liab?.credit ?? []) as any[]) {
    const acct = await byPlaidId(c.account_id);
    if (!acct || !acct.isActive) continue;
    await prisma.liability.create({
      data: {
        accountId: acct.id,
        kind: "credit",
        nextPaymentDueDate: toDate(c.next_payment_due_date),
        minimumPaymentAmount: c.minimum_payment_amount ?? null,
        lastPaymentDate: toDate(c.last_payment_date),
        lastPaymentAmount: c.last_payment_amount ?? null,
        lastStatementBalance: c.last_statement_balance ?? null,
        aprPercentage: c.aprs?.[0]?.apr_percentage ?? null,
        isOverdue: c.is_overdue ?? null,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (liab?.student ?? []) as any[]) {
    const acct = await byPlaidId(s.account_id);
    if (!acct || !acct.isActive) continue;
    await prisma.liability.create({
      data: {
        accountId: acct.id,
        kind: "student",
        nextPaymentDueDate: toDate(s.next_payment_due_date),
        minimumPaymentAmount: s.minimum_payment_amount ?? null,
        lastPaymentDate: toDate(s.last_payment_date),
        lastPaymentAmount: s.last_payment_amount ?? null,
        lastStatementBalance: s.last_statement_balance ?? null,
        aprPercentage: s.interest_rate_percentage ?? null,
        isOverdue: s.is_overdue ?? null,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of (liab?.mortgage ?? []) as any[]) {
    const acct = await byPlaidId(m.account_id);
    if (!acct || !acct.isActive) continue;
    await prisma.liability.create({
      data: {
        accountId: acct.id,
        kind: "mortgage",
        nextPaymentDueDate: toDate(m.next_payment_due_date),
        minimumPaymentAmount: m.next_monthly_payment ?? null,
        lastPaymentDate: toDate(m.last_payment_date),
        lastPaymentAmount: m.last_payment_amount ?? null,
        lastStatementBalance: null,
        aprPercentage: m.interest_rate?.percentage ?? null,
        isOverdue: m.is_overdue ?? null,
      },
    });
  }
}

export async function syncItem(itemId: string): Promise<SyncResult> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, status: "error", error: "Item not found" };

  const accessToken = decrypt(item.accessTokenEnc);

  try {
    const balResp = await plaid.accountsBalanceGet({ access_token: accessToken });
    const accounts = balResp.data.accounts;

    for (const a of accounts) {
      await upsertAccountWithBalance(item.id, item.playerId, item.entity, a);
    }

    await syncLiabilities(accessToken);

    await prisma.item.update({
      where: { id: item.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: "ok", lastSyncError: null },
    });
    return { ok: true, status: "ok", accounts: accounts.length };
  } catch (err: unknown) {
    // Plaid SDK errors carry structured data on err.response.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (err as any)?.response?.data;
    const code: string | undefined = data?.error_code;
    const status =
      code === "ITEM_LOGIN_REQUIRED" || code === "PENDING_EXPIRATION"
        ? "login_required"
        : "error";
    const message =
      data?.error_message ?? (err instanceof Error ? err.message : "Unknown error");

    await prisma.item.update({
      where: { id: item.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: status, lastSyncError: message },
    });
    return { ok: false, status, error: message };
  }
}

/** Sync every connection sequentially. Returns per-item results. */
export async function syncAllItems(): Promise<{ itemId: string; result: SyncResult }[]> {
  const items = await prisma.item.findMany({ select: { id: true } });
  const out: { itemId: string; result: SyncResult }[] = [];
  for (const { id } of items) {
    out.push({ itemId: id, result: await syncItem(id) });
  }
  return out;
}
