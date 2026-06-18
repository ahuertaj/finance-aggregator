import { prisma } from "@/lib/db";
import { AddProgram, ProgramUpdater } from "@/components/points-forms";
import { DeleteButton } from "@/components/actions";
import { money, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PointsPage() {
  const players = await prisma.player.findMany({ orderBy: { label: "asc" } });
  const programs = await prisma.pointsProgram.findMany({
    include: {
      player: true,
      balances: { orderBy: { capturedAt: "desc" }, take: 1 },
      valuations: { orderBy: { effectiveDate: "desc" }, take: 1 },
    },
    orderBy: [{ playerId: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">Points & alternative currencies</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Plaid doesn&apos;t expose reward points, so balances are entered manually. Cash
          value = balance × your per-point valuation, rolled into net worth.
        </p>
        <AddProgram players={players} />
      </section>

      <section>
        {programs.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No programs yet.</p>
        ) : (
          <div className="space-y-3">
            {programs.map((p) => {
              const bal = p.balances[0] ? Number(p.balances[0].balance) : 0;
              const cpp = p.valuations[0] ? Number(p.valuations[0].centsPerPoint) : 0;
              const cash = (bal * cpp) / 100;
              return (
                <div key={p.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-medium">
                      {p.name}{" "}
                      <span className="text-black/50 dark:text-white/50">— {p.player.label}</span>
                    </div>
                    <div className="text-sm">
                      <span className="tabular-nums">{bal.toLocaleString()}</span> pts ×{" "}
                      <span className="tabular-nums">{cpp || "?"}</span>¢ ={" "}
                      <span className="font-semibold tabular-nums">{money(cash)}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <ProgramUpdater programId={p.id} />
                    <span className="flex items-center gap-3 text-xs text-black/50 dark:text-white/50">
                      {p.balances[0] && <span>bal {fmtDate(p.balances[0].capturedAt)}</span>}
                      {p.valuations[0] && <span>val {fmtDate(p.valuations[0].effectiveDate)}</span>}
                      <DeleteButton endpoint="/api/points" id={p.id} confirm="Delete this program?" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
