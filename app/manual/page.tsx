import { prisma } from "@/lib/db";
import { ManualTxnForm } from "@/components/manual-forms";
import { DeleteButton } from "@/components/actions";
import { money, fmtDate, cleanName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  const players = await prisma.player.findMany({ orderBy: { label: "asc" } });
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, name: true, playerId: true },
    orderBy: { name: "asc" },
  });
  const txns = await prisma.manualTransaction.findMany({
    orderBy: { date: "desc" },
    include: { player: true, account: true },
    take: 100,
  });

  const now = new Date();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">Manual entries</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Positive = inflow, negative = outflow. Future-dated entries only affect the
          projected balance until their date arrives.
        </p>
        <ManualTxnForm players={players} accounts={accounts} />
      </section>

      <section>
        {txns.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="text-left text-black/55 dark:text-white/55">
                <tr className="border-b">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Player</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => {
                  const future = t.date > now;
                  const amt = Number(t.amount);
                  return (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        {fmtDate(t.date)}
                        {future && (
                          <span className="ml-1 rounded bg-blue-100 px-1 text-xs text-blue-800">
                            future
                          </span>
                        )}
                        {t.source === "inferred" && (
                          <span className="ml-1 rounded bg-purple-100 px-1 text-xs text-purple-800">
                            inferred
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{t.player.label}</td>
                      <td className="px-4 py-2">{t.account?.name ? cleanName(t.account.name) : "—"}</td>
                      <td className="px-4 py-2">{t.description ?? "—"}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${amt < 0 ? "text-red-600" : "text-green-700"}`}>
                        {money(amt)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <DeleteButton endpoint="/api/manual" id={t.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
