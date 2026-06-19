import { prisma } from "@/lib/db";
import { LinkAccount, Reauth } from "@/components/plaid-link";
import { SyncButton, DeleteButton, SetActiveButton } from "@/components/actions";
import { AccountEditor } from "@/components/account-editor";
import { ManualAccountForm } from "@/components/manual-forms";
import { money, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    ok: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    login_required: "bg-amber-100 text-amber-800",
  };
  const label = status ?? "never synced";
  const cls = status ? map[status] ?? "bg-gray-100 text-gray-800" : "bg-gray-100 text-gray-800";
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

export default async function AccountsPage() {
  const players = await prisma.player.findMany({ orderBy: { label: "asc" } });
  const items = await prisma.item.findMany({
    include: { player: true, accounts: true },
    orderBy: { createdAt: "asc" },
  });
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: {
      player: true,
      balanceSnapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
    orderBy: [{ playerId: "asc" }, { name: "asc" }],
  });
  // Soft-removed accounts (isActive=false), shown separately so they can be restored.
  const removed = await prisma.account.findMany({
    where: { isActive: false },
    include: { player: true },
    orderBy: [{ playerId: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-lg font-semibold">Connections</h1>
        <LinkAccount players={players} />
        <ManualAccountForm players={players} />
      </section>

      <section>
        <h2 className="mb-2 font-medium">Linked institutions</h2>
        {items.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">None yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="text-sm">
                  <div className="font-medium">{it.institutionName ?? "Institution"}</div>
                  <div className="text-black/55 dark:text-white/55">
                    {it.player.label} · {it.entity} · {it.accounts.length} accounts ·{" "}
                    last sync {fmtDate(it.lastSyncAt)}
                  </div>
                  {it.lastSyncError && (
                    <div className="mt-1 text-xs text-red-600">{it.lastSyncError}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={it.lastSyncStatus} />
                  <Reauth itemId={it.id} />
                  <SyncButton itemId={it.id} />
                  <DeleteButton
                    endpoint="/api/items"
                    id={it.id}
                    label="Remove"
                    confirm={`Remove this connection and its ${it.accounts.length} account(s)? This disconnects it from Plaid and deletes their balances/liabilities. This cannot be undone.`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">None yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="text-left text-black/55 dark:text-white/55">
                <tr className="border-b">
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Player</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Latest balance</th>
                  <th className="px-4 py-2">Tags</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const snap = a.balanceSnapshots[0];
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        {a.name}
                        {a.mask && <span className="text-black/40"> ····{a.mask}</span>}
                        {a.isManual && <span className="ml-1 text-xs text-black/40">(manual)</span>}
                      </td>
                      <td className="px-4 py-2">{a.player.label}</td>
                      <td className="px-4 py-2">{a.subtype ?? a.type ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {snap?.current != null ? money(Number(snap.current)) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <AccountEditor
                          account={{ id: a.id, entity: a.entity, rail: a.rail, isMonitored: a.isMonitored }}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {a.isManual ? (
                          <DeleteButton endpoint="/api/accounts" id={a.id} confirm="Delete this manual account?" />
                        ) : (
                          <SetActiveButton
                            id={a.id}
                            active={false}
                            label="Remove"
                            confirm="Remove this account from all totals? A re-sync won't bring it back; you can restore it below."
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {removed.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium text-black/60 dark:text-white/60">Removed accounts</h2>
          <ul className="divide-y rounded-lg border">
            {removed.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span className="text-black/55 dark:text-white/55">
                  {a.player.label} · {a.name}
                  {a.mask && <span className="text-black/40"> ····{a.mask}</span>}
                </span>
                <SetActiveButton
                  id={a.id}
                  active={true}
                  label="Restore"
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
