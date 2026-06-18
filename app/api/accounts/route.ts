import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Create a manual account (cash, or an unmonitored balance like Wise).
const createSchema = z.object({
  playerId: z.coerce.number().int(),
  name: z.string().min(1),
  entity: z.string().default("personal"),
  type: z.string().optional(),
  rail: z.string().optional(),
  isMonitored: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const d = parsed.data;
  const account = await prisma.account.create({
    data: {
      playerId: d.playerId,
      name: d.name,
      entity: d.entity,
      type: d.type ?? null,
      rail: d.rail ?? null,
      isManual: true,
      isMonitored: d.isMonitored,
    },
  });
  return Response.json({ account });
}

// Update tags/metadata on any account (Plaid-backed or manual).
const patchSchema = z.object({
  id: z.string(),
  entity: z.string().optional(),
  rail: z.string().nullable().optional(),
  playerId: z.coerce.number().int().optional(),
  isMonitored: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const { id, ...rest } = parsed.data;
  const account = await prisma.account.update({ where: { id }, data: rest });
  return Response.json({ account });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await prisma.account.delete({ where: { id } });
  return Response.json({ ok: true });
}
