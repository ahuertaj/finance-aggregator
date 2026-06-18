import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Create a manual transaction. `date` may be in the future (balance projection).
const schema = z.object({
  playerId: z.coerce.number().int(),
  accountId: z.string().nullable().optional(),
  entity: z.string().default("personal"),
  amount: z.coerce.number(), // signed: + inflow, - outflow
  date: z.coerce.date(),
  description: z.string().optional(),
  category: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const d = parsed.data;
  const txn = await prisma.manualTransaction.create({
    data: {
      playerId: d.playerId,
      accountId: d.accountId || null,
      entity: d.entity,
      amount: d.amount,
      date: d.date,
      description: d.description ?? null,
      category: d.category ?? null,
    },
  });
  return Response.json({ txn });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await prisma.manualTransaction.delete({ where: { id } });
  return Response.json({ ok: true });
}
