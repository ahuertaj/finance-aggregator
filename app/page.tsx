import Link from "next/link";
import { prisma } from "@/lib/db";
import { getNetWorth, getProjection, getCreditUtilization } from "@/lib/networth";
import { money, fmtDate, daysUntil, accountDisplay } from "@/lib/format";

export const dynamic = "force-dynamic";

async function upcomingDueDates() {
  const liabs = await prisma.liability.findMany({
    where: {
      nextPaymentDueDate: { not: null },
      account: { isActive: true, hiddenFromDashboard: false },
    },
    orderBy: { capturedAt: "desc" },
    include: { account: { include: { player: true } } },
  });
  const seen = new Set<string>();
  const latest = liabs.filter((l) => {
    if (seen.has(l.accountId)) return false;
    seen.add(l.accountId);
    return true;
  });
  // Only surface dates that haven't already passed.
  const upcoming = latest.filter((l) => daysUntil(l.nextPaymentDueDate!) >= 0);
  upcoming.sort(
    (a, b) => a.nextPaymentDueDate!.getTime() - b.nextPaymentDueDate!.getTime(),
  );
  return upcoming.slice(0, 8);
}

export default async function Dashboard() {
  const nw = await getNetWorth();
  const target = new Date();
  target.setDate(target.getDate() + 30);
  const proj = await getProjection(target);
  const due = await upcomingDueDates();
  const util = await getCreditUtilization();
  const hasData = nw.byPlayer.length > 0;

  return (
    <div className="space-y-8">
      {!hasData && (
        <div className="rounded-lg border border-dashed p-6 text-sm">
          No accounts yet.{" "}
          <Link href="/accounts" className="underline">
            Connect an institution
          </Link>{" "}
          or add a manual account to get started.
        </div>
      )}

      <section>
        <div className="text-sm text-black/60 dark:text-white/60">Total net worth</div>
        <div className="text-4xl font-semibold tabular-nums">{money(nw.total)}</div>
        <div className="mt-1 text-sm text-black/60 dark:text-white/60">
          Projected {fmtDate(target)}:{" "}
          <span className="tabular-nums">{money(proj.projected)}</span>{" "}
          <span className={proj.delta >= 0 ? "text-green-600" : "text-red-600"}>
            ({proj.delta >= 0 ? "+" : ""}
            {money(proj.delta)})
          </span>
        </div>
        {util.cards > 0 && util.utilization != null && (
          <div className="mt-1 text-sm text-black/60 dark:text-white/60">
            Credit utilization{" "}
            <span className={`tabular-nums font-medium ${util.utilization >= 0.3 ? "text-red-600" : ""}`}>
              {Math.round(util.utilization * 100)}%
            </span>{" "}
            <span className="text-black/50 dark:text-white/50">
              ({money(util.balance)} of {money(util.limit)} across {util.cards} card
              {util.cards === 1 ? "" : "s"})
            </span>
          </div>
        )}
      </section>

      {hasData && (
        <section className="grid gap-4 sm:grid-cols-2">
          {nw.byPlayer.map((p) => (
            <div key={p.playerId} className="rounded-lg border p-4">
              <div className="flex items-baseline justify-between">
                <div className="font-medium">
                  {p.label} <span className="text-black/50 dark:text-white/50">— {p.name}</span>
                </div>
                <div className="text-lg font-semibold tabular-nums">{money(p.total)}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-medium">Upcoming due dates</h2>
          <Link href="/debt" className="text-sm underline">
            all debt
          </Link>
        </div>
        {due.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No liabilities synced yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {due.map((l) => {
              const d = daysUntil(l.nextPaymentDueDate!);
              return (
                <li key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>
                    <span className="font-medium">{accountDisplay(l.account)}</span>{" "}
                    <span className="text-black/50 dark:text-white/50">
                      ({l.account.player.label} · {l.kind})
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {l.minimumPaymentAmount != null && (
                      <span className="tabular-nums text-black/60 dark:text-white/60">
                        min {money(Number(l.minimumPaymentAmount))}
                      </span>
                    )}
                    <span className={d <= 7 ? "text-red-600" : ""}>
                      {fmtDate(l.nextPaymentDueDate)} ({d}d)
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
