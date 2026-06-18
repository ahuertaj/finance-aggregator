import { NextRequest } from "next/server";
import { syncItem } from "@/lib/sync";

// Manual per-connection sync trigger.
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/sync/[itemId]">) {
  const { itemId } = await ctx.params;
  const result = await syncItem(itemId);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
