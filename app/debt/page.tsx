import { prisma } from "@/lib/db";
import { money, fmtDate, daysUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const liabs = await prisma.liability.findMany({
    orderBy: { capturedAt: "desc" },
    include: { account: { include: { player: true } } },
  });
  // latest liability row per account
  const seen = new Set<string>();
  const latest = liabs.filter((l) => {
    if (seen.has(l.accountId)) return false;
    seen.add(l.accountId);
    return true;
  });
  latest.sort((a, b) => {
    const ax = a.nextPaymentDueDate?.getTime() ?? Infinity;
    const bx = b.nextPaymentDueDate?.getTime() ?? Infinity;
    return ax - bx;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Debt & due dates</h1>
      {latest.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No liabilities synced. Connect a card/loan account and sync it.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-left text-black/55 dark:text-white/55">
              <tr className="border-b">
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2 text-right">Statement bal.</th>
                <th className="px-4 py-2 text-right">Min payment</th>
                <th className="px-4 py-2 text-right">APR</th>
                <th className="px-4 py-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((l) => {
                const d = l.nextPaymentDueDate ? daysUntil(l.nextPaymentDueDate) : null;
                return (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{l.account.name}</td>
                    <td className="px-4 py-2">{l.account.player.label}</td>
                    <td className="px-4 py-2">{l.kind}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.lastStatementBalance != null ? money(Number(l.lastStatementBalance)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.minimumPaymentAmount != null ? money(Number(l.minimumPaymentAmount)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.aprPercentage != null ? `${Number(l.aprPercentage).toFixed(2)}%` : "—"}
                    </td>
                    <td className={`px-4 py-2 ${d != null && d <= 7 ? "text-red-600" : ""}`}>
                      {fmtDate(l.nextPaymentDueDate)}
                      {d != null && <span className="text-black/50"> ({d}d)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
