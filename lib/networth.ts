// Net-worth aggregation + projection.
// - Plaid accounts contribute their latest snapshot balance, signed by type
//   (credit/loan subtract; depository/investment add).
// - Manual accounts contribute the running sum of their manual transactions
//   up to `asOf` (so future-dated entries only count in projections).
// - Account-less manual transactions are player-level adjustments.
// - Points contribute cash value = latest balance × latest valuation (¢/pt).
import { prisma } from "./db";

const LIABILITY_TYPES = new Set(["credit", "loan"]);

export type EntityTotal = { entity: string; total: number };
export type PlayerTotal = {
  playerId: number;
  label: string;
  name: string;
  total: number;
  pointsValue: number;
  byEntity: EntityTotal[];
};
export type NetWorth = {
  asOf: Date;
  total: number;
  pointsValue: number;
  byPlayer: PlayerTotal[];
};

function num(d: unknown): number {
  return d == null ? 0 : Number(d);
}

export async function getNetWorth(asOf: Date = new Date()): Promise<NetWorth> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true, hiddenFromDashboard: false },
    include: {
      player: true,
      balanceSnapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
      manualTransactions: { where: { date: { lte: asOf } } },
    },
  });

  const looseTxns = await prisma.manualTransaction.findMany({
    where: { accountId: null, date: { lte: asOf } },
    include: { player: true },
  });

  const programs = await prisma.pointsProgram.findMany({
    include: {
      player: true,
      balances: { orderBy: { capturedAt: "desc" }, take: 1 },
      valuations: { orderBy: { effectiveDate: "desc" }, take: 1 },
    },
  });

  // playerId -> { meta, entity -> total, pointsValue }
  const players = new Map<
    number,
    { label: string; name: string; entities: Map<string, number>; points: number }
  >();

  const ensure = (playerId: number, label: string, name: string) => {
    let p = players.get(playerId);
    if (!p) {
      p = { label, name, entities: new Map(), points: 0 };
      players.set(playerId, p);
    }
    return p;
  };
  const addEntity = (
    playerId: number,
    label: string,
    name: string,
    entity: string,
    value: number,
  ) => {
    const p = ensure(playerId, label, name);
    p.entities.set(entity, (p.entities.get(entity) ?? 0) + value);
  };

  for (const a of accounts) {
    let value: number;
    if (a.isManual) {
      value = a.manualTransactions.reduce((s, t) => s + num(t.amount), 0);
    } else {
      const current = num(a.balanceSnapshots[0]?.current);
      value = LIABILITY_TYPES.has(a.type ?? "") ? -current : current;
    }
    addEntity(a.playerId, a.player.label, a.player.name, a.entity, value);
  }

  for (const t of looseTxns) {
    addEntity(t.playerId, t.player.label, t.player.name, t.entity, num(t.amount));
  }

  for (const prog of programs) {
    const bal = num(prog.balances[0]?.balance);
    const cpp = num(prog.valuations[0]?.centsPerPoint);
    const cash = (bal * cpp) / 100;
    const p = ensure(prog.playerId, prog.player.label, prog.player.name);
    p.points += cash;
  }

  const byPlayer: PlayerTotal[] = [...players.entries()]
    .map(([playerId, p]) => {
      const byEntity = [...p.entities.entries()]
        .map(([entity, total]) => ({ entity, total }))
        .sort((x, y) => x.entity.localeCompare(y.entity));
      const accountsTotal = byEntity.reduce((s, e) => s + e.total, 0);
      return {
        playerId,
        label: p.label,
        name: p.name,
        pointsValue: p.points,
        total: accountsTotal + p.points,
        byEntity,
      };
    })
    .sort((x, y) => x.label.localeCompare(y.label));

  const total = byPlayer.reduce((s, p) => s + p.total, 0);
  const pointsValue = byPlayer.reduce((s, p) => s + p.pointsValue, 0);

  return { asOf, total, pointsValue, byPlayer };
}

/** Current vs. projected net worth. Projection includes future-dated manual entries. */
export async function getProjection(targetDate: Date) {
  const now = new Date();
  const [current, projected] = await Promise.all([
    getNetWorth(now),
    getNetWorth(targetDate),
  ]);
  return {
    current: current.total,
    projected: projected.total,
    delta: projected.total - current.total,
    targetDate,
  };
}

export type CreditUtilization = {
  balance: number;
  limit: number;
  cards: number; // cards with a known limit (charge cards excluded)
  utilization: number | null; // balance / limit, or null when no limit known
};

/** Aggregate revolving-credit utilization across active, non-hidden credit cards. */
export async function getCreditUtilization(): Promise<CreditUtilization> {
  const accts = await prisma.account.findMany({
    where: { isActive: true, hiddenFromDashboard: false, type: "credit" },
    include: { balanceSnapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });
  let balance = 0;
  let limit = 0;
  let cards = 0;
  for (const a of accts) {
    const s = a.balanceSnapshots[0];
    if (!s || s.limit == null) continue; // charge cards / no preset limit
    balance += num(s.current);
    limit += num(s.limit);
    cards++;
  }
  return { balance, limit, cards, utilization: limit > 0 ? balance / limit : null };
}
