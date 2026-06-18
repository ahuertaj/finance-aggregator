import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Single endpoint for points programs, balance entries, and valuations,
// discriminated by `kind`.
const programSchema = z.object({
  kind: z.literal("program"),
  playerId: z.coerce.number().int(),
  name: z.string().min(1),
  accountId: z.string().nullable().optional(),
});
const balanceSchema = z.object({
  kind: z.literal("balance"),
  programId: z.string(),
  balance: z.coerce.number(),
});
const valuationSchema = z.object({
  kind: z.literal("valuation"),
  programId: z.string(),
  centsPerPoint: z.coerce.number(),
});
const schema = z.discriminatedUnion("kind", [programSchema, balanceSchema, valuationSchema]);

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const d = parsed.data;

  if (d.kind === "program") {
    const program = await prisma.pointsProgram.create({
      data: { playerId: d.playerId, name: d.name, accountId: d.accountId || null },
    });
    return Response.json({ program });
  }
  if (d.kind === "balance") {
    const balance = await prisma.pointsBalance.create({
      data: { programId: d.programId, balance: d.balance, source: "manual" },
    });
    return Response.json({ balance });
  }
  const valuation = await prisma.pointsValuation.create({
    data: { programId: d.programId, centsPerPoint: d.centsPerPoint },
  });
  return Response.json({ valuation });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  // Only programs are deletable here; balances/valuations are append-only history.
  await prisma.pointsProgram.delete({ where: { id } });
  return Response.json({ ok: true });
}
