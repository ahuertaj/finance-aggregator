// Next.js instrumentation: `register()` runs once when a server instance starts
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
// We use it to run a daily background sync of all connections on the always-on host.
// Only meaningful while the server is up (e.g. `next start`/`next dev` on the Mac);
// it is not a hosted cron.
export async function register() {
  // Node runtime only — skip the Edge runtime and the production build phase.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const g = globalThis as unknown as { __dailySyncTimer?: ReturnType<typeof setInterval> };
  if (g.__dailySyncTimer) return; // already scheduled (survives dev Fast Refresh)

  const DAY_MS = 24 * 60 * 60 * 1000;
  const run = async () => {
    try {
      const { syncAllItems } = await import("./lib/sync");
      const results = await syncAllItems();
      const failed = results.filter((r) => !r.result.ok).length;
      console.log(`[daily-sync] ${results.length} connection(s), ${failed} failed`);
    } catch (err) {
      console.error("[daily-sync] failed:", err);
    }
  };

  // Initial run a minute after boot, then once a day.
  setTimeout(run, 60_000);
  g.__dailySyncTimer = setInterval(run, DAY_MS);
  console.log("[daily-sync] scheduled (every 24h while the server runs)");
}
