import { NextRequest } from "next/server";
import { plaid } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

// Remove a connection (Plaid Item): invalidate the access token at Plaid
// (best-effort) then delete the Item locally, which cascades to its accounts,
// balance snapshots, and liabilities. Manual accounts (itemId null) are untouched.
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return Response.json({ error: "not found" }, { status: 404 });

  try {
    await plaid.itemRemove({ access_token: decrypt(item.accessTokenEnc) });
  } catch {
    // Best-effort: still remove locally even if the Plaid call fails (e.g. the
    // item was already removed, or credentials are invalid).
  }

  await prisma.item.delete({ where: { id } });
  return Response.json({ ok: true });
}
