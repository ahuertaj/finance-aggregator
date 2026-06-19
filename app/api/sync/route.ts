import { syncAllItems } from "@/lib/sync";

// Sync every connection. Returns per-item results; ok=true if all succeeded.
export async function POST() {
  const results = await syncAllItems();
  const ok = results.every((r) => r.result.ok);
  return Response.json({ ok, count: results.length, results }, { status: ok ? 200 : 207 });
}
